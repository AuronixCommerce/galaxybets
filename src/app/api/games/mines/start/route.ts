import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { freshAccount, syncWalletView, type PrivateAccount } from "@/lib/wallet/account";
import { minePositions } from "@/lib/game/mines";

export const runtime = "nodejs";
const schema=z.object({betUnits:z.number().int().positive().max(100000000),mines:z.number().int().min(1).max(24)});
export async function POST(request:Request){
 const user=await getSessionUser(); if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const parsed=schema.safeParse(await request.json()); if(!parsed.success)return NextResponse.json({error:"Invalid game settings"},{status:400});
 const ref=adminDb.ref(`private/${user.uid}`); let out:Record<string,unknown>|null=null;
 const tx=await ref.transaction(raw=>{
  const a:PrivateAccount=raw??freshAccount(user.uid); a.gameSessions??={}; a.transactions??={};
  const balance=Number(a.wallet.balanceUnits||0); if(balance<parsed.data.betUnits)return;
  const nonce=a.fairness.nonce||0; const sessionId=`mines_${nonce}_${Date.now()}`; const mines=minePositions(a.fairness.serverSeed,a.fairness.clientSeed,nonce,parsed.data.mines); const now=Date.now();
  a.wallet={balanceUnits:balance-parsed.data.betUnits,updatedAt:now}; a.fairness.nonce=nonce+1;
  a.transactions[`bet_${sessionId}`]={type:"GAME_BET",game:"mines",amountUnits:-parsed.data.betUnits,createdAt:now};
  a.gameSessions[sessionId]={game:"mines",status:"ACTIVE",betUnits:parsed.data.betUnits,minesCount:parsed.data.mines,minePositions:mines,selected:[],multiplier:1,nonce,serverSeedHash:a.fairness.serverSeedHash,clientSeed:a.fairness.clientSeed,createdAt:now};
  out={sessionId,mines:parsed.data.mines,selected:[],multiplier:1,balanceUnits:a.wallet.balanceUnits,serverSeedHash:a.fairness.serverSeedHash,nonce}; return a;
 },{applyLocally:false});
 if(!tx.committed||!out)return NextResponse.json({error:"Bet rejected"},{status:409});
 await syncWalletView(user.uid,Number(out.balanceUnits)); return NextResponse.json(out);
}
