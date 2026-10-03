import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

export type SessionUser = { uid: string; email?: string | null };

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const name = process.env.SESSION_COOKIE_NAME || "galaxy_session";
  const value = cookieStore.get(name)?.value;
  if (!value) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(value, true);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!process.env.SUPER_ADMIN_UID || user.uid !== process.env.SUPER_ADMIN_UID) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
