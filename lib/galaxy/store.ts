import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth/server";
import { hashSeed, newServerSeed } from "@/lib/game/fairness";
import { ensureAccount, normalizeAccount, START_BALANCE_UNITS, type BetRecord, type PrivateAccount, type SessionRecord } from "@/lib/wallet/account";
import { FairRng, GAME_IDS, SESSION_GAMES, initialSession, instantResult, moveSession, sessionView, type GameId, type Options } from "./games";

const MAX_STAKE = 100_000;
const PLAY_WINDOW = 10_000;
const now = () => Date.now();
const gameList = GAME_IDS as readonly string[];

type AccountChange = { committed: boolean; account: PrivateAccount };
function error(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}
export async function userKey() {
  const user = await getSessionUser();
  if (!user) throw error("Unauthorized. Sign in to play and save your demo progress.", 401);
  return user.uid;
}
function validGame(value: unknown): GameId {
  if (typeof value !== "string" || !gameList.includes(value)) throw error("Unknown game.");
  return value as GameId;
}
function validStake(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 100 || (value as number) > MAX_STAKE) throw error("Bet must be between 1 and 1,000 GC.");
  return value as number;
}
function validKey(value: string | null) {
  if (!value || !/^[a-zA-Z0-9_-]{8,100}$/.test(value)) throw error("A valid Idempotency-Key is required.");
  return value;
}
function opts(value: unknown): Options {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Options : {};
}
function rate(account: PrivateAccount, scope: string, max: number, duration: number, time: number) {
  const previous = account.limits?.[scope];
  if (previous && previous.expiresAt > time && previous.count >= max) throw error("Too many requests. Please wait a moment.", 429);
  account.limits![scope] = previous && previous.expiresAt > time
    ? { count: previous.count + 1, expiresAt: previous.expiresAt }
    : { count: 1, expiresAt: time + duration };
}
function allowPlay(account: PrivateAccount, time: number) {
  if (!account.responsible?.ageConfirmed) throw error("Confirm that you are 18+ and accept the Terms before playing.");
  if (account.responsible.excludedUntil > time) throw error("Play is paused for this account.");
  if (account.wallet.balanceUnits < 0) throw error("Demo balance is unavailable.");
  rate(account, "play", 12, PLAY_WINDOW, time);
}
function activeSession(account: PrivateAccount): SessionRecord | null {
  return Object.values(account.gameSessions ?? {}).find(s => s.state === "ACTIVE" && "data" in s) as SessionRecord | undefined ?? null;
}
function betResponse(account: PrivateAccount, id: string) {
  const bet = account.bets?.[id] as BetRecord | undefined;
  if (!bet || typeof bet.stake !== "number") throw error("Game result unavailable. Refresh your history.", 503);
  return { bet, balance: account.wallet.balanceUnits };
}
function sessionResponse(account: PrivateAccount, betId: string) {
  const row = Object.values(account.gameSessions ?? {}).find(s => "betId" in s && s.betId === betId) as SessionRecord | undefined;
  if (!row) throw error("Game session unavailable. Refresh and try again.", 503);
  return { session: { id: row.id, version: row.version, ...sessionView(row.data, row.state) }, balance: account.wallet.balanceUnits };
}
async function transact(uid: string, change: (account: PrivateAccount) => boolean): Promise<AccountChange> {
  const tx = await adminDb.ref(`private/${uid}`).transaction((raw: PrivateAccount | null) => {
    const account = normalizeAccount(raw, uid);
    return change(account) ? account : undefined;
  }, undefined, false);
  return { committed: tx.committed, account: normalizeAccount(tx.snapshot.val() as PrivateAccount | null, uid) };
}
export async function publishView(uid: string, account: PrivateAccount, bet?: BetRecord) {
  const current = activeSession(account);
  const update: Record<string, unknown> = {
    [`walletViews/${uid}`]: { balanceUnits: account.wallet.balanceUnits, balanceGc: account.wallet.balanceUnits / 100, updatedAt: now() },
    [`playerViews/${uid}`]: { balance: account.wallet.balanceUnits, active: current ? { id: current.id, version: current.version, ...sessionView(current.data, current.state) } : null, latestBet: bet ?? null, updatedAt: now() },
  };
  if (bet) update[`live/recent/${bet.id}`] = { game: bet.game, stake: bet.stake, payout: bet.payout, multiplier: bet.multiplier, at: bet.at };
  // A mirror is only a live, read-only projection. The authoritative transaction already committed.
  try { await adminDb.ref().update(update); } catch (cause) { console.error("Realtime projection update failed", cause); }
}

export async function state(uid: string) {
  const account = await ensureAccount(uid);
  const profile = await adminDb.ref(`profiles/${uid}`).get();
  await publishView(uid, account);
  const bets = Object.values(account.bets ?? {}).filter((b): b is BetRecord => typeof b.stake === "number" && typeof b.at === "number")
    .sort((a,b) => b.at - a.at).slice(0,24);
  const active = activeSession(account);
  return {
    balance: account.wallet.balanceUnits,
    resetAt: account.wallet.resetAt ?? 0,
    joinedAt: account.wallet.createdAt ?? account.wallet.updatedAt,
    seedHash: account.fairness.serverSeedHash,
    clientSeed: account.fairness.clientSeed,
    bets,
    favorites: Object.keys(account.favorites ?? {}).filter(key => account.favorites?.[key]),
    active: active ? { id: active.id, version: active.version, ...sessionView(active.data, active.state) } : null,
    excludedUntil: account.responsible?.excludedUntil ?? 0,
    sessionStartedAt: account.responsible?.sessionStartedAt ?? now(),
    ageConfirmed: !!account.responsible?.ageConfirmed,
    signedIn: true,
    isAdmin: uid === process.env.SUPER_ADMIN_UID,
    displayName: profile.child("displayName").val() || profile.child("email").val() || "Galaxy Explorer",
  };
}
export async function confirmAdult(uid: string) {
  await ensureAccount(uid);
  await transact(uid, account => { rate(account, "account", 30, 60_000, now()); account.responsible!.ageConfirmed = true; return true; });
  return { ageConfirmed: true };
}

export async function playInstant(uid: string, body: Record<string, unknown>, keyValue: string | null) {
  const key = validKey(keyValue), game = validGame(body.game), stake = validStake(body.stake);
  if (SESSION_GAMES.includes(game)) throw error("Use the session endpoint for this game.");
  const payload = JSON.stringify({ game, stake, options: opts(body.options) });
  await ensureAccount(uid);
  for (let attempt = 0; attempt < 5; attempt++) {
    const before = normalizeAccount((await adminDb.ref(`private/${uid}`).get()).val() as PrivateAccount | null, uid);
    const duplicate = before.requestKeys?.[key];
    if (duplicate) {
      if (before.requestPayloads?.[key] !== payload) throw error("Invalid idempotency key reuse for a different bet.", 409);
      return betResponse(before, duplicate);
    }
    if (before.wallet.balanceUnits < stake) throw error("Insufficient demo balance.");
    if (!before.responsible?.ageConfirmed || before.responsible.excludedUntil > now()) allowPlay(before, now());
    const fair = before.fairness;
    const result = await instantResult(game, opts(body.options), new FairRng(fair.serverSeed, fair.clientSeed, key));
    const payout = Math.floor(stake * result.payoutBP / 10000);
    const id = crypto.randomUUID(), time = now();
    const bet: BetRecord = { id, game, stake, payout, multiplier: result.payoutBP / 10000, outcome: result.outcome, seedHash: fair.serverSeedHash, clientSeed: fair.clientSeed, nonce: key, status: "SETTLED", at: time };
    const tx = await transact(uid, account => {
      if (account.requestKeys?.[key] || account.fairness.serverSeedHash !== fair.serverSeedHash || account.fairness.clientSeed !== fair.clientSeed) return false;
      if (account.wallet.balanceUnits < stake) return false;
      allowPlay(account, time);
      const balance = account.wallet.balanceUnits - stake + payout;
      if (!Number.isSafeInteger(balance)) throw error("Demo balance limit reached.");
      account.wallet = { ...account.wallet, balanceUnits: balance, updatedAt: time };
      account.bets![id] = bet;
      account.requestKeys![key] = id;
      account.requestPayloads![key] = payload;
      account.transactions![`bet_${id}`] = { type: "GAME_BET", amountUnits: -stake, betId: id, createdAt: time };
      if (payout > 0) account.transactions![`win_${id}`] = { type: "GAME_WIN", amountUnits: payout, betId: id, createdAt: time };
      return true;
    });
    if (tx.committed) { await publishView(uid, tx.account, bet); return betResponse(tx.account, id); }
    if (tx.account.requestKeys?.[key]) {
      if (tx.account.requestPayloads?.[key] !== payload) throw error("Invalid idempotency key reuse for a different bet.", 409);
      return betResponse(tx.account, tx.account.requestKeys[key]);
    }
  }
  throw error("Game state changed. Refresh and try again.", 409);
}

export async function startSession(uid: string, body: Record<string, unknown>, keyValue: string | null) {
  const key = validKey(keyValue), game = validGame(body.game), stake = validStake(body.stake);
  if (!SESSION_GAMES.includes(game)) throw error("Use the instant play endpoint for this game.");
  const payload = JSON.stringify({ game, stake, options: opts(body.options) });
  await ensureAccount(uid);
  for (let attempt = 0; attempt < 5; attempt++) {
    const before = normalizeAccount((await adminDb.ref(`private/${uid}`).get()).val() as PrivateAccount | null, uid);
    const duplicate = before.requestKeys?.[key];
    if (duplicate) {
      if (before.requestPayloads?.[key] !== payload) throw error("Invalid idempotency key reuse for a different bet.", 409);
      return sessionResponse(before, duplicate);
    }
    if (activeSession(before)) throw error("Finish your active game before starting another.");
    if (before.wallet.balanceUnits < stake) throw error("Insufficient demo balance.");
    if (!before.responsible?.ageConfirmed || before.responsible.excludedUntil > now()) allowPlay(before, now());
    const fair = before.fairness;
    const data = await initialSession(game, opts(body.options), stake, new FairRng(fair.serverSeed, fair.clientSeed, key));
    const id = crypto.randomUUID(), sessionId = crypto.randomUUID(), time = now();
    const bet: BetRecord = { id, game, stake, payout: 0, multiplier: 0, outcome: {}, seedHash: fair.serverSeedHash, clientSeed: fair.clientSeed, nonce: key, status: "ACTIVE", at: time };
    const row: SessionRecord = { id: sessionId, betId: id, game, state: "ACTIVE", data, version: 0, updatedAt: time };
    const tx = await transact(uid, account => {
      if (account.requestKeys?.[key] || account.fairness.serverSeedHash !== fair.serverSeedHash || account.fairness.clientSeed !== fair.clientSeed) return false;
      if (activeSession(account) || account.wallet.balanceUnits < stake) return false;
      allowPlay(account, time);
      account.wallet = { ...account.wallet, balanceUnits: account.wallet.balanceUnits - stake, updatedAt: time };
      account.bets![id] = bet;
      account.gameSessions![sessionId] = row;
      account.requestKeys![key] = id;
      account.requestPayloads![key] = payload;
      account.transactions![`bet_${id}`] = { type: "GAME_BET", amountUnits: -stake, betId: id, createdAt: time };
      return true;
    });
    if (tx.committed) { await publishView(uid, tx.account); return sessionResponse(tx.account, id); }
    if (tx.account.requestKeys?.[key]) {
      if (tx.account.requestPayloads?.[key] !== payload) throw error("Invalid idempotency key reuse for a different bet.", 409);
      return sessionResponse(tx.account, tx.account.requestKeys[key]);
    }
    if (activeSession(tx.account)) throw error("Finish your active game before starting another.");
  }
  throw error("Game state changed. Refresh and try again.", 409);
}

export async function sessionAction(uid: string, body: Record<string, unknown>) {
  const id = body.sessionId, version = body.version, action = body.action;
  if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id) || !Number.isSafeInteger(version) || typeof action !== "string") throw error("Invalid game move.");
  await ensureAccount(uid);
  let event = "Already updated";
  let settledBet: BetRecord | undefined;
  const tx = await transact(uid, account => {
    const row = account.gameSessions?.[id] as SessionRecord | undefined;
    if (!row || !row.data || row.state !== "ACTIVE" || row.version !== version) return false;
    const time = now();
    rate(account, "move", 20, PLAY_WINDOW, time);
    const move = moveSession(row.data, action, body.pick);
    const payout = move.state === "ACTIVE" ? 0 : Math.floor(move.data.stake * move.payoutBP / 10000);
    const balance = account.wallet.balanceUnits + payout;
    if (!Number.isSafeInteger(balance)) throw error("Demo balance limit reached.");
    const updated: SessionRecord = { ...row, data: move.data, state: move.state, version: row.version + 1, updatedAt: time };
    account.gameSessions![id] = updated;
    event = move.event;
    if (move.state !== "ACTIVE") {
      account.wallet = { ...account.wallet, balanceUnits: balance, updatedAt: time };
      const bet = account.bets?.[row.betId] as BetRecord | undefined;
      if (bet) {
        settledBet = { ...bet, payout, multiplier: move.payoutBP / 10000, outcome: { event: move.event, ...sessionView(move.data, move.state) }, status: move.state };
        account.bets![row.betId] = settledBet;
      }
      if (payout > 0) account.transactions![`win_${row.betId}`] = { type: "GAME_WIN", amountUnits: payout, betId: row.betId, createdAt: time };
    }
    return true;
  });
  const row = tx.account.gameSessions?.[id] as SessionRecord | undefined;
  if (!row || !row.data) throw error("Game session not found.");
  if (tx.committed) await publishView(uid, tx.account, settledBet);
  return { session: { id: row.id, version: row.version, ...sessionView(row.data, row.state) }, balance: tx.account.wallet.balanceUnits, event: tx.committed ? event : "Already updated" };
}

export async function toggleFavorite(uid: string, value: unknown) {
  const game = validGame(value);
  await ensureAccount(uid);
  const tx = await transact(uid, account => { rate(account, "account", 30, 60_000, now()); account.favorites![game] = !account.favorites?.[game]; return true; });
  return { game, favorite: !!tx.account.favorites?.[game] };
}
export async function pausePlay(uid: string, hours: unknown) {
  const value = Number(hours);
  if (![1,24,168,720].includes(value)) throw error("Choose a cooling-off duration.");
  await ensureAccount(uid);
  const until = now() + value * 60 * 60 * 1000;
  const tx = await transact(uid, account => { rate(account, "account", 30, 60_000, now()); account.responsible!.excludedUntil = Math.max(until, account.responsible!.excludedUntil); return true; });
  return { excludedUntil: tx.account.responsible!.excludedUntil };
}
export async function resetDemo(uid: string) {
  await ensureAccount(uid);
  const tx = await transact(uid, account => {
    const time = now();
    if (activeSession(account)) throw error("Finish your active game before resetting credits.");
    if ((account.wallet.resetAt ?? 0) + 86_400_000 > time) throw error("Demo balance resets once every 24 hours.");
    rate(account, "reset", 2, 60_000, time);
    const delta = START_BALANCE_UNITS - account.wallet.balanceUnits;
    account.wallet = { ...account.wallet, balanceUnits: START_BALANCE_UNITS, resetAt: time, updatedAt: time };
    account.transactions![`reset_${time}`] = { type: "DEMO_RESET", amountUnits: delta, createdAt: time };
    return true;
  });
  await publishView(uid, tx.account);
  return { balance: tx.account.wallet.balanceUnits, resetAt: tx.account.wallet.resetAt };
}
export async function rotateSeed(uid: string, value?: unknown) {
  await ensureAccount(uid);
  const before = await ensureAccount(uid);
  const clientSeed = value === undefined ? before.fairness.clientSeed : String(value);
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(clientSeed)) throw error("Client seed must be 4–64 letters or digits.");
  const seed = newServerSeed(), hash = hashSeed(seed), time = now(), revealId = crypto.randomUUID();
  let previous: { serverSeed: string; serverSeedHash: string; clientSeed: string } | undefined;
  const tx = await transact(uid, account => {
    if (activeSession(account)) throw error("Finish your active game before rotating seeds.");
    if (account.fairness.serverSeedHash !== before.fairness.serverSeedHash) return false;
    rate(account, "seed", 5, 3_600_000, time);
    previous = { serverSeed: account.fairness.serverSeed, serverSeedHash: account.fairness.serverSeedHash, clientSeed: account.fairness.clientSeed };
    account.revealedSeeds![revealId] = { ...previous, revealedAt: time };
    account.fairness = { ...account.fairness, serverSeed: seed, serverSeedHash: hash, clientSeed };
    return true;
  });
  if (!tx.committed || !previous) throw error("Seed changed in another request. Refresh fairness and try again.", 409);
  return { seedHash: hash, clientSeed, previous };
}
export async function revealed(uid: string) {
  const account = await ensureAccount(uid);
  return Object.values(account.revealedSeeds ?? {}).sort((a,b) => b.revealedAt - a.revealedAt).slice(0,10);
}
