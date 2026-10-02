import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { readBalance, UNITS_PER_GC } from "@/lib/wallet/account";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const balanceUnits = await readBalance(user.uid);
  return NextResponse.json({ balanceUnits, balanceGc: balanceUnits / UNITS_PER_GC });
}
