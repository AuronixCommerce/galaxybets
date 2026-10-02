import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { readBalance, UNITS_PER_GC } from "@/lib/wallet/account";
import { ShieldCheck, UserRound, WalletCards } from "lucide-react";

export const dynamic = "force-dynamic";
export default async function AccountPage(){
  const user=await getSessionUser(); if(!user) redirect("/login");
  const balance=await readBalance(user.uid);
  const isAdmin=user.uid===process.env.SUPER_ADMIN_UID;
  return <div className="accountPage"><div className="accountHero"><span className="sectionKicker">PLAYER PROFILE</span><h1>Your Galaxy account</h1><p>{user.email||"Firebase account"}</p></div><div className="accountCards"><section><UserRound/><span><small>Account ID</small><b>{user.uid.slice(0,8)}••••{user.uid.slice(-5)}</b></span></section><section><WalletCards/><span><small>Demo balance</small><b>{(balance/UNITS_PER_GC).toLocaleString(undefined,{minimumFractionDigits:2})} GC</b></span></section><section><ShieldCheck/><span><small>Security</small><b>Server session active</b></span></section></div>{isAdmin&&<Link className="primaryBtn adminEntry" href="/admin">OPEN ADMIN CONTROL ROOM</Link>}</div>
}
