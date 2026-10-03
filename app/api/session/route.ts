import { sessionAction, startSession, userKey } from "@/lib/galaxy/store";
import { fail, reply, sameOrigin, objectBody } from "@/lib/galaxy/http";
export async function POST(request: Request) {
  try { sameOrigin(request); const body = objectBody(await request.json()); return reply(await startSession(await userKey(), body, request.headers.get("Idempotency-Key"))); }
  catch(error) { return fail(error); }
}
export async function PATCH(request: Request) {
  try { sameOrigin(request); const body = objectBody(await request.json()); return reply(await sessionAction(await userKey(), body)); }
  catch(error) { return fail(error); }
}
