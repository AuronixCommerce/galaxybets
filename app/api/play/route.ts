import { playInstant, userKey } from "@/lib/galaxy/store";
import { fail, reply, sameOrigin, objectBody } from "@/lib/galaxy/http";
export async function POST(request: Request) {
  try { sameOrigin(request); const body = objectBody(await request.json()); return reply(await playInstant(await userKey(), body, request.headers.get("Idempotency-Key"))); }
  catch(error) { return fail(error); }
}
