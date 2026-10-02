import crypto from "node:crypto";

export function newServerSeed() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashSeed(seed: string) {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

export function hmacHex(serverSeed: string, clientSeed: string, nonce: number, game: string) {
  return crypto
    .createHmac("sha256", serverSeed)
    .update(`${clientSeed}:${nonce}:${game}`)
    .digest("hex");
}

export function unitFloatFromHex(hex: string) {
  const n = Number.parseInt(hex.slice(0, 13), 16);
  return n / 0x10000000000000;
}

export function defaultClientSeed(uid: string) {
  return crypto.createHash("sha256").update(`galaxy:${uid}`).digest("hex").slice(0, 24);
}
