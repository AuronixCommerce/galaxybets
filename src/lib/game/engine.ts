import { adminDb } from "@/lib/firebase/admin";
import { freshAccount, syncWalletView, type PrivateAccount } from "@/lib/wallet/account";
import { hmacHex, unitFloatFromHex } from "@/lib/game/fairness";

function safeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

export async function runAtomicBet<T>(args: {
  uid: string;
  idempotencyKey: string;
  betUnits: number;
  game: string;
  resolve: (ctx: { account: PrivateAccount; random: number; nonce: number }) => { payoutUnits: number; result: T };
}) {
  if (!Number.isSafeInteger(args.betUnits) || args.betUnits <= 0 || args.betUnits > 100_000_000) {
    throw new Error("INVALID_BET");
  }
  if (!args.idempotencyKey) throw new Error("MISSING_IDEMPOTENCY");

  const key = safeKey(args.idempotencyKey);
  const ref = adminDb.ref(`private/${args.uid}`);
  let response: { payoutUnits: number; result: T; balanceUnits: number; betId: string } | null = null;

  const tx = await ref.transaction((raw) => {
    const account: PrivateAccount = raw ?? freshAccount(args.uid);
    account.idempotency ??= {};
    account.transactions ??= {};
    account.bets ??= {};

    const previous = account.idempotency[key] as typeof response | undefined;
    if (previous) {
      response = previous;
      return account;
    }

    const balance = Number(account.wallet?.balanceUnits ?? 0);
    if (balance < args.betUnits) return;

    const nonce = Number(account.fairness?.nonce ?? 0);
    const hex = hmacHex(account.fairness.serverSeed, account.fairness.clientSeed, nonce, args.game);
    const random = unitFloatFromHex(hex);
    const resolved = args.resolve({ account, random, nonce });
    if (!Number.isSafeInteger(resolved.payoutUnits) || resolved.payoutUnits < 0) return;

    const nextBalance = balance - args.betUnits + resolved.payoutUnits;
    if (!Number.isSafeInteger(nextBalance) || nextBalance < 0) return;

    const now = Date.now();
    const betId = `${args.game}_${nonce}_${now}`;
    account.wallet = { balanceUnits: nextBalance, updatedAt: now };
    account.fairness.nonce = nonce + 1;
    account.transactions[`bet_${betId}`] = { type: "GAME_BET", game: args.game, amountUnits: -args.betUnits, createdAt: now };
    if (resolved.payoutUnits > 0) {
      account.transactions[`win_${betId}`] = { type: "GAME_WIN", game: args.game, amountUnits: resolved.payoutUnits, createdAt: now };
    }
    account.bets[betId] = {
      game: args.game,
      betUnits: args.betUnits,
      payoutUnits: resolved.payoutUnits,
      nonce,
      serverSeedHash: account.fairness.serverSeedHash,
      clientSeed: account.fairness.clientSeed,
      result: resolved.result,
      createdAt: now,
    };
    response = { payoutUnits: resolved.payoutUnits, result: resolved.result, balanceUnits: nextBalance, betId };
    account.idempotency[key] = response;
    return account;
  }, { applyLocally: false });

  if (!tx.committed || !response) throw new Error("BET_REJECTED");
  await syncWalletView(args.uid, response.balanceUnits);
  return response;
}
