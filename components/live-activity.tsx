"use client";

import { useEffect, useState } from "react";
import { limitToLast, onValue, orderByChild, query, ref } from "firebase/database";
import { firebaseDb } from "@/lib/firebase/client";
import { Activity } from "lucide-react";

type LiveBet = { game: string; stake: number; payout: number; multiplier: number; at: number };
const gc = (units: number) => (units / 100).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
export default function LiveActivity() {
  const [bets, setBets] = useState<Array<LiveBet & { id: string }>>([]);
  const [status, setStatus] = useState("Connecting to live activity…");
  useEffect(() => onValue(query(ref(firebaseDb, "live/recent"), orderByChild("at"), limitToLast(8)), snapshot => {
    const entries = snapshot.val() as Record<string, LiveBet> | null;
    setBets(Object.entries(entries ?? {}).map(([id, bet]) => ({ ...bet, id })).sort((a, b) => b.at - a.at));
    setStatus("Live · updated automatically");
  }, () => setStatus("Live activity is unavailable right now.")), []);
  return <section className="gb-live-activity" aria-label="Live demo activity">
    <div className="gb-live-heading"><div><Activity size={18}/><strong>Live activity</strong><span className="gb-live-dot"/></div><small>{status}</small></div>
    {bets.length ? <div className="gb-live-list" aria-live="polite">{bets.map(bet => <div className="gb-live-row" key={bet.id}><span className="gb-live-game">{bet.game}</span><span>{gc(bet.stake)} GC</span><strong className={bet.payout > 0 ? "gb-positive" : "gb-negative"}>{bet.payout > 0 ? `+${gc(bet.payout)} GC` : "No payout"}</strong><time dateTime={new Date(bet.at).toISOString()}>{new Date(bet.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>)}</div> : <p className="gb-live-empty">New demo rounds appear here as they settle.</p>}
  </section>;
}
