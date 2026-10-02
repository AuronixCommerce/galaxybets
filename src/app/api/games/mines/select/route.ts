import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { minesMultiplier } from "@/lib/game/mines";
import type { PrivateAccount } from "@/lib/wallet/account";

export const runtime="nodejs";
const schema=z.object({sessionId:z.string().min(5),tile:z.number().int().min(0).max(24)});
type MinesSession={status:string;betUnits:number;minesCount:number;minePositions:number[];selected:number[];multiplier:number};
export async function POST(request:Request){
 const user=await getSessionUser(); if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const parsed=schema.safeParse(await request.json()); if(!parsed.success)return NextResponse.json({error:"Invalid selection"},{status:400});
 const ref=adminDb.ref(`private/${user.uid}`); let out:Record<string,unknown>|null=null;
 const tx=await ref.transaction(raw=>{
  if(!raw)return; const a=raw as PrivateAccount; const s=(a.gameSessions?.[parsed.data.sessionId] as MinesSession|undefined); if(!s||s.status!=="ACTIVE"||s.selected.includes(parsed.data.tile))return;
  const hit=s.minePositions.includes(parsed.data.tile); if(hit){s.status="LOST"; out={status:"LOST",hit:true,tile:parsed.data.tile,mines:s.minePositions,selected:s.selected,multiplier:s.multiplier};return a;}
  s.selected=[...s.selected,parsed.data.tile]; s.multiplier=minesMultiplier(s.minesCount,s.selected.length);
  if(s.selected.length===25-s.minesCount){s.status="CLEARED";}
  out={status:s.status,hit:false,tile:parsed.data.tile,selected:s.selected,multiplier:s.multiplier}; return a;
 },{applyLocally:false});
 if(!tx.committed||!out)return NextResponse.json({error:"Selection rejected"},{status:409}); return NextResponse.json(out);
}
