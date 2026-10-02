import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { syncWalletView, type PrivateAccount } from "@/lib/wallet/account";

export const runtime="nodejs";
const schema=z.object({sessionId:z.string().min(5)});
type MinesSession={status:string;betUnits:number;minePositions:number[];selected:number[];multiplier:number};
export async function POST(request:Request){
 const user=await getSessionUser(); if(!user)return NextResponse.json({error:"Unauthorized"},{status:401}); const parsed=schema.safeParse(await request.json()); if(!parsed.success)return NextResponse.json({error:"Invalid request"},{status:400});
 const ref=adminDb.ref(`private/${user.uid}`); let out:Record<string,unknown>|null=null;
 const tx=await ref.transaction(raw=>{
  if(!raw)return; const a=raw as PrivateAccount; a.transactions??={}; const s=a.gameSessions?.[parsed.data.sessionId] as MinesSession|undefined; if(!s||s.status!=="ACTIVE"||s.selected.length<1)return;
  const payoutUnits=Math.floor(s.betUnits*s.multiplier); const next=a.wallet.balanceUnits+payoutUnits; if(!Number.isSafeInteger(next))return; const now=Date.now(); s.status="CASHED_OUT"; a.wallet={balanceUnits:next,updatedAt:now}; a.transactions[`win_${parsed.data.sessionId}`]={type:"GAME_WIN",game:"mines",amountUnits:payoutUnits,createdAt:now}; out={status:"CASHED_OUT",payoutUnits,balanceUnits:next,multiplier:s.multiplier,mines:s.minePositions,selected:s.selected}; return a;
 },{applyLocally:false});
 if(!tx.committed||!out)return NextResponse.json({error:"Cashout rejected"},{status:409}); await syncWalletView(user.uid,Number(out.balanceUnits)); return NextResponse.json(out);
}
