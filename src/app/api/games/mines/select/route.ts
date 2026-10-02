import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { minesMultiplier } from "@/lib/game/mines";
import type { PrivateAccount } from "@/lib/wallet/account";

export const runtime = "nodejs";

const schema = z.object({
  sessionId: z.string().min(5),
  tile: z.number().int().min(0).max(24),
});

type MinesSession = {
  status: string;
  betUnits: number;
  minesCount: number;
  minePositions: number[];
  selected: number[];
  multiplier: number;
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid selection" }, { status: 400 });
  }

  const { sessionId, tile } = parsed.data;
  const ref = adminDb.ref(`private/${user.uid}`);

  const tx = await ref.transaction((raw) => {
    if (!raw) return;

    const account = raw as PrivateAccount;
    const session = account.gameSessions?.[sessionId] as MinesSession | undefined;

    if (!session || session.status !== "ACTIVE" || session.selected.includes(tile)) {
      return;
    }

    if (session.minePositions.includes(tile)) {
      session.status = "LOST";
      return account;
    }

    session.selected = [...session.selected, tile];
    session.multiplier = minesMultiplier(session.minesCount, session.selected.length);

    if (session.selected.length === 25 - session.minesCount) {
      session.status = "CLEARED";
    }

    return account;
  });

  if (!tx.committed) {
    return NextResponse.json({ error: "Selection rejected" }, { status: 409 });
  }

  const committed = tx.snapshot.val() as PrivateAccount;
  const session = committed.gameSessions?.[sessionId] as MinesSession | undefined;
  if (!session) {
    return NextResponse.json({ error: "Session unavailable" }, { status: 500 });
  }

  const hit = session.minePositions.includes(tile);

  return NextResponse.json({
    status: session.status,
    hit,
    tile,
    selected: session.selected,
    multiplier: session.multiplier,
    ...(hit ? { mines: session.minePositions } : {}),
  });
}
