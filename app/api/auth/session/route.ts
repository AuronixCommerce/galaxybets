import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { readBalance } from "@/lib/wallet/account";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }
    const { idToken } = await request.json();
    if (typeof idToken !== "string" || idToken.length < 20) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    await Promise.all([
      readBalance(decoded.uid),
      adminDb.ref(`profiles/${decoded.uid}`).update({ uid: decoded.uid, email: decoded.email ?? null, displayName: decoded.name ?? null, lastSeenAt: Date.now() })
    ]);
    const response = NextResponse.json({ ok: true, uid: decoded.uid });
    response.cookies.set(process.env.SESSION_COOKIE_NAME || "galaxy_session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresIn / 1000,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }
}
