import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/server";
import { runAtomicBet } from "@/lib/game/engine";

export const runtime = "nodejs";
const schema = z.object({ betUnits: z.number().int().positive(), target: z.number().min(2).max(98), mode: z.enum(["under", "over"]) });

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid wager" }, { status: 400 });
  const idempotencyKey = request.headers.get("Idempotency-Key") || "";
  try {
    const { betUnits, target, mode } = parsed.data;
    const winChance = mode === "under" ? target : 100 - target;
    const multiplier = Math.floor((99 / winChance) * 10000) / 10000;
    const result = await runAtomicBet({
      uid: user.uid, idempotencyKey, betUnits, game: "dice",
      resolve: ({ random }) => {
        const roll = Math.floor(random * 10001) / 100;
        const won = mode === "under" ? roll < target : roll > target;
        const payoutUnits = won ? Math.floor(betUnits * multiplier) : 0;
        return { payoutUnits, result: { roll, target, mode, won, multiplier } };
      }
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bet failed";
    return NextResponse.json({ error: message }, { status: message === "BET_REJECTED" ? 409 : 400 });
  }
}
