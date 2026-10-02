import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { freshAccount, syncWalletView, type PrivateAccount } from "@/lib/wallet/account";
import { minePositions } from "@/lib/game/mines";

export const runtime = "nodejs";

const schema = z.object({
  betUnits: z.number().int().positive().max(100000000),
  mines: z.number().int().min(1).max(24),
});

type MinesSession = {
  game: "mines";
  status: "ACTIVE";
  betUnits: number;
  minesCount: number;
  minePositions: number[];
  selected: number[];
  multiplier: number;
  nonce: number;
  serverSeedHash: string;
  clientSeed: string;
  createdAt: number;
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid game settings" }, { status: 400 });
  }

  const sessionId = `mines_${crypto.randomUUID()}`;
  const ref = adminDb.ref(`private/${user.uid}`);

  const tx = await ref.transaction((raw) => {
    const account: PrivateAccount = raw ?? freshAccount(user.uid);
    account.gameSessions ??= {};
    account.transactions ??= {};

    const balance = Number(account.wallet.balanceUnits || 0);
    if (balance < parsed.data.betUnits) return;

    const nonce = account.fairness.nonce || 0;
    const positions = minePositions(
      account.fairness.serverSeed,
      account.fairness.clientSeed,
      nonce,
      parsed.data.mines,
    );
    const now = Date.now();

    account.wallet = {
      balanceUnits: balance - parsed.data.betUnits,
      updatedAt: now,
    };
    account.fairness.nonce = nonce + 1;
    account.transactions[`bet_${sessionId}`] = {
      type: "GAME_BET",
      game: "mines",
      amountUnits: -parsed.data.betUnits,
      createdAt: now,
    };
    account.gameSessions[sessionId] = {
      game: "mines",
      status: "ACTIVE",
      betUnits: parsed.data.betUnits,
      minesCount: parsed.data.mines,
      minePositions: positions,
      selected: [],
      multiplier: 1,
      nonce,
      serverSeedHash: account.fairness.serverSeedHash,
      clientSeed: account.fairness.clientSeed,
      createdAt: now,
    } satisfies MinesSession;

    return account;
  });

  if (!tx.committed) {
    return NextResponse.json({ error: "Bet rejected" }, { status: 409 });
  }

  const committed = tx.snapshot.val() as PrivateAccount;
  const session = committed.gameSessions?.[sessionId] as MinesSession | undefined;
  if (!session) {
    return NextResponse.json({ error: "Session creation failed" }, { status: 500 });
  }

  const balanceUnits = Number(committed.wallet.balanceUnits);
  await syncWalletView(user.uid, balanceUnits);

  return NextResponse.json({
    sessionId,
    mines: session.minesCount,
    selected: session.selected,
    multiplier: session.multiplier,
    balanceUnits,
    serverSeedHash: session.serverSeedHash,
    nonce: session.nonce,
  });
}
