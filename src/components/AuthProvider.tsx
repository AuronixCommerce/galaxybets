"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";

type AuthContextValue = { user: User | null; loading: boolean; refreshSession: (user: User) => Promise<void>; logout: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshSession(nextUser: User) {
    const idToken = await nextUser.getIdToken(true);
    const res = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
    if (!res.ok) throw new Error("Could not create secure session");
  }

  async function logout() {
    await Promise.allSettled([signOut(firebaseAuth), fetch("/api/auth/logout", { method: "POST" })]);
    location.href = "/";
  }

  useEffect(() => onAuthStateChanged(firebaseAuth, async (next) => {
    setUser(next);
    if (next) await refreshSession(next).catch(() => undefined);
    setLoading(false);
  }), []);

  const value = useMemo(() => ({ user, loading, refreshSession, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
