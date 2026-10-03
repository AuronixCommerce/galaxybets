"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FairRng, SESSION_GAMES, instantResult, sha256, type GameId, type Options } from "@/lib/galaxy/games";

type FairBet={id:string;game:string;stake:number;outcome:Record<string,unknown>;seedHash:string;clientSeed:string;nonce:string;at:number};
type Revealed={serverSeed:string;serverSeedHash:string;clientSeed:string;revealedAt:number};
export default function FairVerifier({bets,revealed}:{bets:FairBet[];revealed:Revealed[]}){
  const [selected,setSelected]=useState<FairBet|null>(null);
  const [seed,setSeed]=useState("");
  const [message,setMessage]=useState("");
  const [checking,setChecking]=useState(false);
  const verify=async()=>{
    if(!selected||!seed){setMessage("Select a bet and enter its revealed server seed.");return;}
    setChecking(true);
    try{
      const hash=await sha256(seed.trim());
      if(hash!==selected.seedHash){setMessage("Seed hash does not match this bet. Check the revealed seed.");return;}
      if(SESSION_GAMES.includes(selected.game as GameId)){setMessage("Seed commitment verified. This verifier checks full outcomes for instant games; step-by-step session replay is not available here yet.");return;}
      const o=selected.outcome;
      const options:Options={target:o.target,mode:o.mode,pick:o.pick,rows:o.rows,risk:o.risk,selected:o.selected};
      const reproduced=await instantResult(selected.game as GameId,options,new FairRng(seed.trim(),selected.clientSeed,selected.nonce));
      setMessage(JSON.stringify(reproduced.outcome)===JSON.stringify(selected.outcome)?"Verified: the seed hash and game result match.":"Seed hash matches, but the game result differs. Save this bet ID and report it.");
    }catch{setMessage("Could not verify this bet. Check the seed and try again.");}
    finally{setChecking(false);}
  };
  return <div className="gb-info-card gb-verifier"><h2>Verify a bet</h2><p>Rotate your seed first. Choose an instant game bet made with that seed, then use the revealed server seed to recreate its result.</p><div className="gb-verifier-bets">{bets.slice(0,12).map(b=><button key={b.id} className={selected?.id===b.id?"active":""} onClick={()=>{setSelected(b);setMessage("");const match=revealed.find(x=>x.serverSeedHash===b.seedHash);setSeed(match?.serverSeed??"");}}>{b.game} <span>{b.id.slice(0,8)}</span></button>)}</div>{selected&&<><label>Bet ID</label><code>{selected.id}</code><label>Client seed and nonce</label><code>{selected.clientSeed} · {selected.nonce}</code><label htmlFor="verify-seed">Revealed server seed</label><input id="verify-seed" value={seed} onChange={e=>setSeed(e.target.value)} placeholder="Paste the revealed seed"/><Button disabled={checking} onClick={verify}>Verify result</Button>{message&&<p role="status" className="gb-verify-message">{message}</p>}</>}</div>;
}
