import { adminDb } from "@/lib/firebase/admin";
import { hashSeed, newServerSeed, defaultClientSeed } from "@/lib/game/fairness";

export const UNITS_PER_GC = 100;
export const START_BALANCE_UNITS = 10_000 * UNITS_PER_GC;

export type PrivateAccount = {
  wallet: { balanceUnits: number; updatedAt: number };
  fairness: { serverSeed: string; serverSeedHash: string; clientSeed: string; nonce: number };
  idempotency?: Record<string, unknown>;
  transactions?: Record<string, unknown>;
  bets?: Record<string, unknown>;
  gameSessions?: Record<string, unknown>;
};

export function freshAccount(uid: string): PrivateAccount {
  const serverSeed = newServerSeed();
  const now = Date.now();
  return {
    wallet: { balanceUnits: START_BALANCE_UNITS, updatedAt: now },
    fairness: {
      serverSeed,
      serverSeedHash: hashSeed(serverSeed),
      clientSeed: defaultClientSeed(uid),
      nonce: 0,
    },
    idempotency: {},
    transactions: {
      [`welcome_${now}`]: {
        type: "DEMO_CREDIT",
        amountUnits: START_BALANCE_UNITS,
        createdAt: now,
        note: "Welcome demo balance",
      },
    },
    bets: {},
  };
}

export async function readBalance(uid: string) {
  const ref = adminDb.ref(`private/${uid}`);
  const snap = await ref.get();
  if (!snap.exists()) {
    await ref.set(freshAccount(uid));
    await syncWalletView(uid, START_BALANCE_UNITS);
    return START_BALANCE_UNITS;
  }
  return Number(snap.child("wallet/balanceUnits").val() ?? 0);
}

export async function syncWalletView(uid: string, balanceUnits: number) {
  await adminDb.ref(`walletViews/${uid}`).set({
    balanceUnits,
    balanceGc: balanceUnits / UNITS_PER_GC,
    updatedAt: Date.now(),
  });
}
