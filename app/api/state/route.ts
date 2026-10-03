import { state, userKey } from "@/lib/galaxy/store";
import { fail, reply } from "@/lib/galaxy/http";
export async function GET() { try { return reply(await state(await userKey())); } catch(error) { return fail(error); } }
