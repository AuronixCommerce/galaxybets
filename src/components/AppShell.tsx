"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Gamepad2, Sparkles, Gift, UserRound, ShieldCheck, Dices, Rocket, CircleDot, Layers3, Bomb, Spade, CircleDollarSign } from "lucide-react";
import { GalaxyMark } from "./GalaxyMark";
import { useAuth } from "./AuthProvider";
import { useEffect, useState } from "react";

const nav = [
  ["Home", "/", Home], ["Originals", "/#originals", Sparkles], ["Dice", "/originals/dice", Dices],
  ["Crash", "/#games", Rocket], ["Plinko", "/#games", CircleDot], ["Towers", "/#games", Layers3],
  ["Mines", "/originals/mines", Bomb], ["Blackjack", "/#games", Spade], ["Coinflip", "/originals/coinflip", CircleDollarSign]
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => { if (user) fetch("/api/wallet").then(r => r.ok ? r.json() : null).then(d => d && setBalance(d.balanceGc)).catch(() => undefined); else setBalance(null); }, [user]);
  return <div className="appShell">
    <aside className="sidebar">
      <GalaxyMark />
      <div className="sideLabel">CASINO</div>
      <nav className="sideNav">{nav.map(([label, href, Icon]) => <Link className={pathname === href ? "active" : ""} href={href} key={label}><Icon size={18}/><span>{label}</span></Link>)}</nav>
      <div className="sideFooter"><Link href="/#responsible"><ShieldCheck size={17}/>Responsible Play</Link></div>
    </aside>
    <div className="mainColumn">
      <header className="topbar">
        <div className="mobileBrand"><GalaxyMark /></div>
        <div className="topSearch"><Gamepad2 size={17}/><span>Search games</span><kbd>⌘ K</kbd></div>
        <div className="topActions">
          {user && <div className="balancePill"><span>DEMO</span><strong>{balance == null ? "••••" : balance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} GC</strong></div>}
          {!loading && !user && <><Link className="ghostBtn" href="/login">Log in</Link><Link className="primaryBtn small" href="/register">Register</Link></>}
          {user && <button className="avatarBtn" onClick={logout} title="Sign out">{(user.email?.[0] || "G").toUpperCase()}</button>}
        </div>
      </header>
      <main>{children}</main>
    </div>
    <nav className="mobileNav">
      <Link href="/"><Home/><span>Home</span></Link><Link href="/#games"><Gamepad2/><span>Casino</span></Link><Link href="/#originals"><Sparkles/><span>Originals</span></Link><Link href="/#rewards"><Gift/><span>Rewards</span></Link><Link href={user ? "/account" : "/login"}><UserRound/><span>Account</span></Link>
    </nav>
  </div>;
}
