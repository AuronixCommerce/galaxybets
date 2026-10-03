export const GAME_IDS = ["dice", "crash", "plinko", "towers", "mines", "hilo", "blackjack", "coinflip", "chicken", "limbo", "wheel", "keno", "roulette", "baccarat", "poker"] as const;
export type GameId = typeof GAME_IDS[number];
export const SESSION_GAMES: GameId[] = ["towers", "mines", "hilo", "blackjack", "chicken", "poker"];
export type Options = Record<string, unknown>;
export type GameOutcome = { payoutBP: number; outcome: Record<string, unknown> };

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function newSeed() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class FairRng {
  private digest = new Uint8Array(0);
  private index = 0;
  private block = 0;
  private key: Promise<CryptoKey>;
  constructor(seed: string, private clientSeed: string, private nonce: string) {
    this.key = crypto.subtle.importKey("raw", new TextEncoder().encode(seed), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  }
  private async word() {
    if (this.index + 4 > this.digest.length) {
      const key = await this.key;
      this.digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${this.clientSeed}:${this.nonce}:${this.block++}`)));
      this.index = 0;
    }
    const n = ((this.digest[this.index] * 0x1000000) + (this.digest[this.index + 1] << 16) + (this.digest[this.index + 2] << 8) + this.digest[this.index + 3]) >>> 0;
    this.index += 4;
    return n;
  }
  async int(max: number) {
    if (!Number.isInteger(max) || max < 1 || max > 0x100000000) throw new Error("Invalid random range");
    const limit = Math.floor(0x100000000 / max) * max;
    let value: number;
    do { value = await this.word(); } while (value >= limit);
    return value % max;
  }
  async shuffle<T>(array: T[]) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = await this.int(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

function numeric(value: unknown, fallback: number, min: number, max: number) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`Choose a value from ${min} to ${max}.`);
  return number;
}
function choice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if (!allowed.includes(value as T)) throw new Error("Invalid game option.");
  return value as T;
}
function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let value = 1;
  for (let i = 1; i <= k; i++) value = value * (n - i + 1) / i;
  return value;
}
function bp(value: number) { return Math.max(0, Math.round(value * 10000)); }

export async function instantResult(game: GameId, opts: Options, rng: FairRng): Promise<GameOutcome> {
  if (game === "dice") {
    const target = numeric(opts.target, 50, 2, 98);
    const mode = choice(opts.mode, ["under", "over"] as const, "under");
    const roll = await rng.int(10000);
    const chance = mode === "under" ? Math.floor(target * 100) : 10000 - Math.floor(target * 100);
    const won = mode === "under" ? roll < chance : roll >= 10000 - chance;
    return { payoutBP: won ? Math.floor(99000000 / chance) : 0, outcome: { roll: roll / 100, target, mode, won } };
  }
  if (game === "coinflip") {
    const pick = choice(opts.pick, ["Galaxy", "Nova"] as const, "Galaxy");
    const result = (await rng.int(2)) === 0 ? "Galaxy" : "Nova";
    return { payoutBP: result === pick ? 19800 : 0, outcome: { pick, result, won: result === pick } };
  }
  if (game === "limbo" || game === "crash") {
    const target = numeric(opts.target, 2, 1.1, 100);
    const roll = await rng.int(1000000000);
    const result = Math.min(1000, Math.floor((0.99 / (1 - roll / 1000000000)) * 100) / 100);
    const won = result >= target;
    return { payoutBP: won ? bp(target) : 0, outcome: { target, result, won, mode: game === "crash" ? "solo round" : undefined } };
  }
  if (game === "plinko") {
    const rows = numeric(opts.rows, 12, 8, 16);
    if (![8, 10, 12, 14, 16].includes(rows)) throw new Error("Choose 8, 10, 12, 14, or 16 rows.");
    const risk = choice(opts.risk, ["low", "medium", "high"] as const, "medium");
    const path: number[] = [];
    let slot = 0;
    for (let i = 0; i < rows; i++) { const turn = await rng.int(2); path.push(turn); slot += turn; }
    const exponent = risk === "low" ? 1.2 : risk === "medium" ? 2.5 : 4;
    const weights = Array.from({ length: rows + 1 }, (_, i) => Math.pow(1 + Math.abs(i - rows / 2), exponent));
    const expected = weights.reduce((sum, weight, i) => sum + weight * combinations(rows, i) / 2 ** rows, 0);
    const multiplier = Math.round((weights[slot] * .99 / expected) * 100) / 100;
    return { payoutBP: bp(multiplier), outcome: { rows, risk, slot, path, multiplier, won: multiplier >= 1 } };
  }
  if (game === "wheel") {
    const segments = [0, 0, .4, .6, .8, 1, 1, 1.2, 1.5, 3.4];
    const segment = await rng.int(segments.length);
    return { payoutBP: bp(segments[segment]), outcome: { segment, multiplier: segments[segment], won: segments[segment] >= 1 } };
  }
  if (game === "roulette") {
    const pick = choice(opts.pick, ["red", "black", "green"] as const, "red");
    const number = await rng.int(37);
    const red = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
    const color = number === 0 ? "green" : red.has(number) ? "red" : "black";
    const won = pick === color;
    return { payoutBP: won ? (pick === "green" ? 360000 : 20000) : 0, outcome: { number, color, pick, won } };
  }
  if (game === "keno") {
    const selected = opts.selected;
    if (!Array.isArray(selected) || selected.length !== 5 || selected.some(n => !Number.isInteger(n) || n < 1 || n > 40) || new Set(selected).size !== 5) throw new Error("Pick five unique numbers from 1 to 40.");
    const draw = (await rng.shuffle(Array.from({ length: 40 }, (_, i) => i + 1))).slice(0, 10).sort((a,b)=>a-b);
    const matches = draw.filter(n => selected.includes(n)).length;
    const multipliers = [0, 0, .8, 4, 25, 550];
    return { payoutBP: bp(multipliers[matches]), outcome: { selected, draw, matches, multiplier: multipliers[matches], won: matches >= 3 } };
  }
  if (game === "baccarat") {
    const pick = choice(opts.pick, ["player", "banker", "tie"] as const, "player");
    const deck = await rng.shuffle(Array.from({ length: 52 }, (_, i) => (i % 13) + 1));
    const val = (n: number) => n >= 10 ? 0 : n;
    const player = [deck[0], deck[2]], banker = [deck[1], deck[3]];
    const total = (cards: number[]) => cards.reduce((sum, card) => sum + val(card), 0) % 10;
    if (total(player) < 8 && total(banker) < 8) {
      if (total(player) <= 5) player.push(deck[4]);
      if (total(banker) <= 5) banker.push(deck[player.length === 3 ? 5 : 4]);
    }
    const result = total(player) === total(banker) ? "tie" : total(player) > total(banker) ? "player" : "banker";
    const won = result === pick;
    return { payoutBP: won ? (pick === "tie" ? 80000 : pick === "banker" ? 19500 : 20000) : 0, outcome: { player, banker, playerTotal: total(player), bankerTotal: total(banker), pick, result, won } };
  }
  throw new Error("This game starts as a session.");
}

export type SessionData = Record<string, unknown> & { game: GameId; stake: number; multiplierBP: number; step: number };
const cardDeck = () => Array.from({ length: 52 }, (_, i) => i);
const rank = (card: number) => (card % 13) + 2;
const blackjackValue = (cards: number[]) => { let sum = 0, aces = 0; for (const card of cards) { const r = rank(card); if (r === 14) aces++; sum += r === 14 ? 11 : Math.min(r, 10); } while (sum > 21 && aces) { sum -= 10; aces--; } return sum; };

export async function initialSession(game: GameId, opts: Options, stake: number, rng: FairRng): Promise<SessionData> {
  if (game === "mines") {
    const mineCount = numeric(opts.mineCount, 3, 1, 24);
    if (!Number.isInteger(mineCount)) throw new Error("Mine count must be whole.");
    const mines = (await rng.shuffle(Array.from({ length: 25 }, (_, i) => i))).slice(0, mineCount);
    return { game, stake, multiplierBP: 10000, step: 0, mineCount, mines, revealed: [] };
  }
  if (game === "towers") {
    const difficulty = choice(opts.difficulty, ["easy", "medium", "hard", "expert"] as const, "medium");
    const safeCount = { easy: 3, medium: 2, hard: 1, expert: 1 }[difficulty];
    const cols = difficulty === "expert" ? 5 : 4;
    const rows = [];
    for (let i = 0; i < 7; i++) rows.push((await rng.shuffle(Array.from({ length: cols }, (_, j) => j))).slice(0, safeCount));
    return { game, stake, multiplierBP: 10000, step: 0, difficulty, cols, safeCount, rows, picks: [] };
  }
  if (game === "chicken") {
    const difficulty = choice(opts.difficulty, ["easy", "medium", "hard", "insane"] as const, "medium");
    const safety = { easy: 85, medium: 70, hard: 55, insane: 40 }[difficulty];
    const lanes = [];
    for (let i = 0; i < 8; i++) lanes.push((await rng.int(100)) < safety);
    return { game, stake, multiplierBP: 10000, step: 0, difficulty, safety, lanes };
  }
  if (game === "hilo") {
    const deck = await rng.shuffle(cardDeck());
    return { game, stake, multiplierBP: 10000, step: 0, deck, current: deck[0], history: [deck[0]] };
  }
  if (game === "blackjack") {
    const deck = await rng.shuffle(cardDeck());
    return { game, stake, multiplierBP: 10000, step: 0, deck, cursor: 4, player: [deck[0], deck[2]], dealer: [deck[1], deck[3]] };
  }
  if (game === "poker") {
    const deck = await rng.shuffle(cardDeck());
    return { game, stake, multiplierBP: 10000, step: 0, deck, hand: deck.slice(0, 5) };
  }
  throw new Error("This is an instant game.");
}

export type SessionMove = { data: SessionData; state: "ACTIVE" | "WON" | "LOST" | "CASHED_OUT"; payoutBP: number; event: string };
export function sessionView(data: SessionData, state: string) {
  const { game, stake, step, multiplierBP } = data;
  const result: Record<string, unknown> = { game, stake, step, multiplier: multiplierBP / 10000, state };
  if (game === "mines") Object.assign(result, { mineCount: data.mineCount, revealed: data.revealed, mines: state === "ACTIVE" ? undefined : data.mines });
  if (game === "towers") Object.assign(result, { difficulty: data.difficulty, cols: data.cols, picks: data.picks, rows: state === "ACTIVE" ? undefined : data.rows });
  if (game === "chicken") Object.assign(result, { difficulty: data.difficulty, lanes: state === "ACTIVE" ? (data.lanes as boolean[]).slice(0, step) : data.lanes });
  if (game === "hilo") Object.assign(result, { current: data.current, history: data.history });
  if (game === "blackjack") Object.assign(result, { player: data.player, dealer: state === "ACTIVE" ? [(data.dealer as number[])[0], null] : data.dealer, playerTotal: blackjackValue(data.player as number[]), dealerTotal: state === "ACTIVE" ? undefined : blackjackValue(data.dealer as number[]) });
  if (game === "poker") Object.assign(result, { hand: data.hand });
  return result;
}

function pokerMultiplier(hand: number[]) {
  const ranks = hand.map(rank).sort((a,b)=>a-b);
  const suits = hand.map(n => Math.floor(n / 13));
  const counts = [...new Set(ranks)].map(r => ranks.filter(n => n === r).length).sort((a,b)=>b-a);
  const flush = new Set(suits).size === 1;
  const straight = ranks.every((n,i)=>i===0 || n===ranks[0]+i) || ranks.join(",") === "2,3,4,5,14";
  if (flush && straight && ranks[0] === 10) return { name: "Royal flush", value: 800 };
  if (flush && straight) return { name: "Straight flush", value: 50 };
  if (counts[0] === 4) return { name: "Four of a kind", value: 25 };
  if (counts[0] === 3 && counts[1] === 2) return { name: "Full house", value: 9 };
  if (flush) return { name: "Flush", value: 6 };
  if (straight) return { name: "Straight", value: 4 };
  if (counts[0] === 3) return { name: "Three of a kind", value: 3 };
  if (counts[0] === 2 && counts[1] === 2) return { name: "Two pair", value: 2 };
  if (counts[0] === 2 && ranks.some(r => r >= 11 && ranks.filter(n => n === r).length === 2)) return { name: "Jacks or better", value: 1 };
  return { name: "No pair", value: 0 };
}

export function moveSession(data: SessionData, action: string, pick?: unknown): SessionMove {
  const game = data.game;
  if (action === "cashout" && ["mines", "towers", "chicken", "hilo"].includes(game)) {
    if (data.step < 1) throw new Error("Make a move before cashing out.");
    return { data, state: "CASHED_OUT", payoutBP: data.multiplierBP, event: "Cashed out" };
  }
  if (game === "mines" && action === "select") {
    const cell = Number(pick);
    if (!Number.isInteger(cell) || cell < 0 || cell > 24 || (data.revealed as number[]).includes(cell)) throw new Error("Choose an unopened tile.");
    const revealed = [...data.revealed as number[], cell];
    const hit = (data.mines as number[]).includes(cell);
    const step = data.step + 1;
    const multiplierBP = hit ? data.multiplierBP : Math.min(10000000, Math.floor(9900 * combinations(25, step) / combinations(25 - Number(data.mineCount), step)));
    const next = { ...data, revealed, step, multiplierBP };
    if (hit) return { data: next, state: "LOST", payoutBP: 0, event: "Supernova" };
    if (step === 25 - Number(data.mineCount)) return { data: next, state: "WON", payoutBP: multiplierBP, event: "Board cleared" };
    return { data: next, state: "ACTIVE", payoutBP: 0, event: "Safe tile" };
  }
  if (game === "towers" && action === "select") {
    const cell = Number(pick);
    if (!Number.isInteger(cell) || cell < 0 || cell >= Number(data.cols)) throw new Error("Choose a tile.");
    const safe = (data.rows as number[][])[data.step].includes(cell);
    const step = data.step + 1;
    const multiplierBP = Math.min(10000000, Math.floor(9900 * Math.pow(Number(data.cols) / Number(data.safeCount), step)));
    const next = { ...data, picks: [...data.picks as number[], cell], step, multiplierBP };
    return safe ? { data: next, state: step === 7 ? "WON" : "ACTIVE", payoutBP: step === 7 ? multiplierBP : 0, event: "Safe ascent" } : { data: next, state: "LOST", payoutBP: 0, event: "Trap" };
  }
  if (game === "chicken" && action === "step") {
    const safe = (data.lanes as boolean[])[data.step];
    const step = data.step + 1;
    const multiplierBP = Math.min(10000000, Math.floor(9900 * Math.pow(100 / Number(data.safety), step)));
    const next = { ...data, step, multiplierBP };
    return safe ? { data: next, state: step === 8 ? "WON" : "ACTIVE", payoutBP: step === 8 ? multiplierBP : 0, event: "Lane crossed" } : { data: next, state: "LOST", payoutBP: 0, event: "Hazard" };
  }
  if (game === "hilo" && action === "guess") {
    const guess = choice(pick, ["higher", "lower", "same"] as const, "higher");
    const deck = data.deck as number[];
    const current = Number(data.current), nextCard = deck[data.step + 1];
    const possible = deck.slice(data.step + 1);
    const chance = possible.filter(c => guess === "higher" ? rank(c) > rank(current) : guess === "lower" ? rank(c) < rank(current) : rank(c) === rank(current)).length / possible.length;
    if (chance === 0) throw new Error("That prediction has no possible card.");
    const won = guess === "higher" ? rank(nextCard) > rank(current) : guess === "lower" ? rank(nextCard) < rank(current) : rank(nextCard) === rank(current);
    const step = data.step + 1;
    const multiplierBP = Math.min(10000000, Math.floor(data.multiplierBP * .99 / chance));
    const next = { ...data, step, multiplierBP, current: nextCard, history: [...data.history as number[], nextCard] };
    return won ? { data: next, state: step >= 8 ? "WON" : "ACTIVE", payoutBP: step >= 8 ? multiplierBP : 0, event: "Correct guess" } : { data: next, state: "LOST", payoutBP: 0, event: "Wrong guess" };
  }
  if (game === "blackjack" && ["hit", "stand"].includes(action)) {
    const deck = data.deck as number[], player = [...data.player as number[]], dealer = [...data.dealer as number[]];
    let cursor = Number(data.cursor);
    if (action === "hit") player.push(deck[cursor++]);
    const total = blackjackValue(player);
    if (total > 21) return { data: { ...data, player, cursor, step: data.step + 1 }, state: "LOST", payoutBP: 0, event: "Bust" };
    if (action === "hit" && total < 21) return { data: { ...data, player, cursor, step: data.step + 1 }, state: "ACTIVE", payoutBP: 0, event: "Card dealt" };
    while (blackjackValue(dealer) < 17) dealer.push(deck[cursor++]);
    const dealerTotal = blackjackValue(dealer);
    const payoutBP = dealerTotal > 21 || total > dealerTotal ? (player.length === 2 && total === 21 ? 25000 : 20000) : total === dealerTotal ? 10000 : 0;
    return { data: { ...data, player, dealer, cursor, step: data.step + 1 }, state: payoutBP ? "WON" : "LOST", payoutBP, event: payoutBP === 10000 ? "Push" : payoutBP ? "Hand won" : "Dealer wins" };
  }
  if (game === "poker" && action === "draw") {
    if (!Array.isArray(pick) || pick.length > 5 || pick.some(n => !Number.isInteger(n) || n < 0 || n > 4) || new Set(pick).size !== pick.length) throw new Error("Select valid cards to hold.");
    const deck = data.deck as number[], hand = [...data.hand as number[]];
    let cursor = 5;
    for (let i = 0; i < 5; i++) if (!pick.includes(i)) hand[i] = deck[cursor++];
    const result = pokerMultiplier(hand);
    return { data: { ...data, hand, step: 1, rankName: result.name, multiplierBP: bp(result.value) }, state: result.value ? "WON" : "LOST", payoutBP: bp(result.value), event: result.name };
  }
  throw new Error("Invalid action for this game.");
}
