import { hmacHex } from "@/lib/game/fairness";

export function minePositions(serverSeed: string, clientSeed: string, nonce: number, mines: number) {
  return Array.from({ length: 25 }, (_, tile) => ({
    tile,
    score: hmacHex(serverSeed, clientSeed, nonce, `mines:${tile}`),
  })).sort((a, b) => a.score.localeCompare(b.score)).slice(0, mines).map(x => x.tile).sort((a,b)=>a-b);
}

function choose(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return result;
}

export function minesMultiplier(mines: number, safePicks: number) {
  if (safePicks <= 0) return 1;
  const totalSafe = 25 - mines;
  const survival = choose(totalSafe, safePicks) / choose(25, safePicks);
  if (survival <= 0) return 0;
  return Math.floor((0.99 / survival) * 10000) / 10000;
}
