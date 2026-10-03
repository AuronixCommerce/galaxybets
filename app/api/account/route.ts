import { confirmAdult, pausePlay, resetDemo, toggleFavorite, userKey } from "@/lib/galaxy/store";
import { fail, reply, sameOrigin, objectBody } from "@/lib/galaxy/http";
export async function POST(request: Request) {
  try { sameOrigin(request); const body = objectBody(await request.json()); const user = await userKey();
    if (body.action === "favorite") return reply(await toggleFavorite(user, body.game));
    if (body.action === "confirm-adult") return reply(await confirmAdult(user));
    if (body.action === "reset") return reply(await resetDemo(user));
    if (body.action === "pause") return reply(await pausePlay(user, body.hours));
    throw new Error("Invalid account action.");
  } catch(error) { return fail(error); }
}
