import { revealed, rotateSeed, userKey } from "@/lib/galaxy/store";
import { fail, reply, sameOrigin, objectBody } from "@/lib/galaxy/http";
export async function GET() { try { return reply({ revealed: await revealed(await userKey()) }); } catch(error) { return fail(error); } }
export async function POST(request: Request) {
  try { sameOrigin(request); const body = objectBody(await request.json()); return reply(await rotateSeed(await userKey(), body.clientSeed)); }
  catch(error) { return fail(error); }
}
