import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { freshAccount, type PrivateAccount } from "@/lib/wallet/account";
import { publishView } from "@/lib/galaxy/store";

export const runtime = "nodejs";

const schema = z.object({
  uid: z.string().regex(/^[A-Za-z0-9_-]{5,128}$/),
  amountUnits: z.number().int().min(-100000000).max(100000000),
  reason: z.string().min(3).max(160),
});

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const admin = await getSessionUser();
  if (!admin || admin.uid !== process.env.SUPER_ADMIN_UID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { uid, amountUnits, reason } = parsed.data;
  const ref = adminDb.ref(`private/${uid}`);

  const tx = await ref.transaction((raw) => {
    const account: PrivateAccount = raw ?? freshAccount(uid);
    account.transactions ??= {};

    const current = Number(account.wallet.balanceUnits || 0);
    const next = current + amountUnits;
    if (!Number.isSafeInteger(next) || next < 0) return;

    const now = Date.now();
    account.wallet = { balanceUnits: next, updatedAt: now };
    account.transactions[`admin_${now}`] = {
      type: "ADMIN_ADJUSTMENT",
      amountUnits,
      reason,
      adminUid: admin.uid,
      createdAt: now,
    };
    return account;
  });

  if (!tx.committed) {
    return NextResponse.json({ error: "Adjustment rejected" }, { status: 409 });
  }

  const committed = tx.snapshot.val() as PrivateAccount;
  const newBalance = Number(committed.wallet.balanceUnits);

  await Promise.all([
    publishView(uid, committed),
    adminDb.ref(`admin/actions/${Date.now()}_${admin.uid}`).set({
      type: "ADJUST_BALANCE",
      targetUid: uid,
      amountUnits,
      reason,
      adminUid: admin.uid,
      createdAt: Date.now(),
    }),
  ]);

  return NextResponse.json({ ok: true, balanceUnits: newBalance });
}
