"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onIdTokenChanged, signOut, type User } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";

type AuthContextValue = { user: User | null; loading: boolean; refreshSession: (user: User) => Promise<void>; logout: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshSession(nextUser: User) {
    const idToken = await nextUser.getIdToken(true);
    const res = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
    if (!res.ok) throw new Error("Could not create secure session");
  }

  async function logout() {
    await Promise.allSettled([signOut(firebaseAuth), fetch("/api/auth/logout", { method: "POST" })]);
    router.replace("/");
    router.refresh();
  }

  useEffect(() => onIdTokenChanged(firebaseAuth, async (next) => {
    if (next) await refreshSession(next).catch(() => undefined);
    setUser(next);
    setLoading(false);
  }), []);

  const value = { user, loading, refreshSession, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
