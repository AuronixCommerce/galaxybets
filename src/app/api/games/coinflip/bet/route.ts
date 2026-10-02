import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/server";
import { runAtomicBet } from "@/lib/game/engine";

export const runtime = "nodejs";
const schema = z.object({ betUnits: z.number().int().positive(), choice: z.enum(["GALAXY", "NOVA"]) });

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid wager" }, { status: 400 });
  try {
    const idempotencyKey = request.headers.get("Idempotency-Key") || "";
    const result = await runAtomicBet({
      uid: user.uid, idempotencyKey, betUnits: parsed.data.betUnits, game: "coinflip",
      resolve: ({ random }) => {
        const landed = random < 0.5 ? "GALAXY" : "NOVA";
        const won = landed === parsed.data.choice;
        return { payoutUnits: won ? Math.floor(parsed.data.betUnits * 1.98) : 0, result: { landed, choice: parsed.data.choice, won, multiplier: 1.98 } };
      }
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bet failed";
    return NextResponse.json({ error: message }, { status: message === "BET_REJECTED" ? 409 : 400 });
  }
}
