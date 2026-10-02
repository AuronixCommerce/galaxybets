import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { ShieldCheck, Users, Activity, DatabaseZap, KeyRound } from "lucide-react";

export const dynamic = "force-dynamic";
export default async function AdminPage(){
 const user=await getSessionUser(); if(!user) redirect("/login"); if(user.uid!==process.env.SUPER_ADMIN_UID) return <div className="denied"><ShieldCheck size={46}/><span>403</span><h1>Access denied</h1><p>This control room is restricted to the configured Galaxy Bets super-admin UID.</p></div>;
 const [profiles,actions]=await Promise.all([adminDb.ref("profiles").get(),adminDb.ref("admin/actions").get()]);
 const users=profiles.exists()?profiles.numChildren():0; const actionCount=actions.exists()?actions.numChildren():0;
 return <div className="adminPage"><div className="adminHero"><div><span className="sectionKicker">CONTROL ROOM</span><h1>Galaxy Administration</h1><p>Authenticated as the single configured super-admin.</p></div><div className="secureBadge"><ShieldCheck/> UID LOCK ACTIVE</div></div><div className="adminStats"><div><Users/><span><b>{users}</b><small>Profiles</small></span></div><div><Activity/><span><b>{actionCount}</b><small>Admin actions</small></span></div><div><DatabaseZap/><span><b>RTDB</b><small>Backend</small></span></div><div><KeyRound/><span><b>1</b><small>Super admin</small></span></div></div><div className="adminGrid"><section><span className="sectionKicker">SECURITY</span><h2>Server-enforced access</h2><p>Every admin API verifies the Firebase session and exact UID before executing privileged actions.</p></section><section><span className="sectionKicker">WALLET</span><h2>Atomic demo ledger</h2><p>Game bets and payouts run inside Realtime Database transactions with idempotency protection.</p></section><section><span className="sectionKicker">GAMES</span><h2>Server-authoritative engines</h2><p>Dice and Coinflip are live. Mines, Towers, Crash, Blackjack and other engines slot into the same protected foundation.</p></section></div></div>
}
