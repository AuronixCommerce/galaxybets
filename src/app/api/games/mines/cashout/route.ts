import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { syncWalletView, type PrivateAccount } from "@/lib/wallet/account";

export const runtime = "nodejs";

const schema = z.object({ sessionId: z.string().min(5) });

type MinesSession = {
  status: string;
  betUnits: number;
  minePositions: number[];
  selected: number[];
  multiplier: number;
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { sessionId } = parsed.data;
  const ref = adminDb.ref(`private/${user.uid}`);

  const tx = await ref.transaction((raw) => {
    if (!raw) return;

    const account = raw as PrivateAccount;
    account.transactions ??= {};
    const session = account.gameSessions?.[sessionId] as MinesSession | undefined;

    if (!session || session.status !== "ACTIVE" || session.selected.length < 1) {
      return;
    }

    const payoutUnits = Math.floor(session.betUnits * session.multiplier);
    const nextBalance = account.wallet.balanceUnits + payoutUnits;
    if (!Number.isSafeInteger(nextBalance)) return;

    const now = Date.now();
    session.status = "CASHED_OUT";
    account.wallet = { balanceUnits: nextBalance, updatedAt: now };
    account.transactions[`win_${sessionId}`] = {
      type: "GAME_WIN",
      game: "mines",
      amountUnits: payoutUnits,
      createdAt: now,
    };

    return account;
  });

  if (!tx.committed) {
    return NextResponse.json({ error: "Cashout rejected" }, { status: 409 });
  }

  const committed = tx.snapshot.val() as PrivateAccount;
  const session = committed.gameSessions?.[sessionId] as MinesSession | undefined;
  if (!session) {
    return NextResponse.json({ error: "Session unavailable" }, { status: 500 });
  }

  const payoutUnits = Math.floor(session.betUnits * session.multiplier);
  const balanceUnits = Number(committed.wallet.balanceUnits);
  await syncWalletView(user.uid, balanceUnits);

  return NextResponse.json({
    status: "CASHED_OUT",
    payoutUnits,
    balanceUnits,
    multiplier: session.multiplier,
    mines: session.minePositions,
    selected: session.selected,
  });
}
