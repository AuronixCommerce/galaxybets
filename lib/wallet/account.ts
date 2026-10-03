import { adminDb } from "@/lib/firebase/admin";
import { hashSeed, newServerSeed, defaultClientSeed } from "@/lib/game/fairness";
import type { GameId, SessionData } from "@/lib/galaxy/games";

export const UNITS_PER_GC = 100;
export const START_BALANCE_UNITS = 10_000 * UNITS_PER_GC;

export type BetRecord = {
  id: string; game: GameId; stake: number; payout: number; multiplier: number;
  outcome: Record<string, unknown>; seedHash: string; clientSeed: string;
  nonce: string; status: string; at: number;
};
export type SessionRecord = {
  id: string; betId: string; game: GameId; state: string;
  data: SessionData; version: number; updatedAt: number;
};
export type PrivateAccount = {
  wallet: { balanceUnits: number; updatedAt: number; createdAt?: number; resetAt?: number };
  fairness: { serverSeed: string; serverSeedHash: string; clientSeed: string; nonce?: number };
  responsible?: { ageConfirmed: boolean; excludedUntil: number; sessionStartedAt: number };
  favorites?: Record<string, boolean>;
  requestKeys?: Record<string, string>;
  requestPayloads?: Record<string, string>;
  transactions?: Record<string, { type: string; amountUnits: number; createdAt: number; betId?: string; [key: string]: unknown }>;
  bets?: Record<string, BetRecord | Record<string, unknown>>;
  gameSessions?: Record<string, SessionRecord | Record<string, unknown>>;
  revealedSeeds?: Record<string, { serverSeed: string; serverSeedHash: string; clientSeed: string; revealedAt: number }>;
  limits?: Record<string, { count: number; expiresAt: number }>;
};

export function freshAccount(uid: string): PrivateAccount {
  const serverSeed = newServerSeed();
  const now = Date.now();
  return {
    wallet: { balanceUnits: START_BALANCE_UNITS, updatedAt: now, createdAt: now, resetAt: 0 },
    fairness: { serverSeed, serverSeedHash: hashSeed(serverSeed), clientSeed: defaultClientSeed(uid), nonce: 0 },
    responsible: { ageConfirmed: false, excludedUntil: 0, sessionStartedAt: now },
    favorites: {}, requestKeys: {}, requestPayloads: {}, bets: {}, gameSessions: {}, revealedSeeds: {}, limits: {},
    transactions: { [`welcome_${now}`]: { type: "DEMO_CREDIT", amountUnits: START_BALANCE_UNITS, createdAt: now } },
  };
}

export function normalizeAccount(raw: PrivateAccount | null, uid: string): PrivateAccount {
  const account = raw ?? freshAccount(uid);
  account.wallet.createdAt ??= account.wallet.updatedAt;
  account.wallet.resetAt ??= 0;
  account.responsible ??= { ageConfirmed: false, excludedUntil: 0, sessionStartedAt: Date.now() };
  account.favorites ??= {};
  account.requestKeys ??= {};
  account.requestPayloads ??= {};
  account.bets ??= {};
  account.gameSessions ??= {};
  account.transactions ??= {};
  account.revealedSeeds ??= {};
  account.limits ??= {};
  return account;
}

export async function ensureAccount(uid: string): Promise<PrivateAccount> {
  const ref = adminDb.ref(`private/${uid}`);
  const transaction = await ref.transaction((raw: PrivateAccount | null) => raw ? undefined : freshAccount(uid), undefined, false);
  const account = transaction.snapshot.val() as PrivateAccount | null;
  if (!account) throw new Error("Demo wallet is temporarily unavailable.");
  return normalizeAccount(account, uid);
}

export async function readBalance(uid: string) {
  const account = await ensureAccount(uid);
  await syncWalletView(uid, account.wallet.balanceUnits);
  return account.wallet.balanceUnits;
}

export async function syncWalletView(uid: string, balanceUnits: number) {
  await adminDb.ref(`walletViews/${uid}`).set({
    balanceUnits,
    balanceGc: balanceUnits / UNITS_PER_GC,
    updatedAt: Date.now(),
  });
}
