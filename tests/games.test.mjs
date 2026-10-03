import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../lib/galaxy/games.ts",import.meta.url),"utf8");
const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {FairRng,sha256,newSeed,instantResult,initialSession,moveSession,sessionView}=await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

test("fair seed commitment and deterministic nonce",async()=>{
  const seed=newSeed(),hash=await sha256(seed);
  assert.match(hash,/^[a-f0-9]{64}$/);
  const a=await instantResult("dice",{target:50,mode:"under"},new FairRng(seed,"client","nonce-1"));
  const b=await instantResult("dice",{target:50,mode:"under"},new FairRng(seed,"client","nonce-1"));
  assert.deepEqual(a,b);
  assert.equal(a.payoutBP===0||a.payoutBP===19800,true);
});

test("all instant games return finite, bounded outcomes",async()=>{
  const seed=newSeed();
  const options={dice:{target:49,mode:"over"},crash:{target:2},plinko:{rows:12,risk:"high"},coinflip:{pick:"Nova"},limbo:{target:5},wheel:{},keno:{selected:[1,2,3,4,5]},roulette:{pick:"red"},baccarat:{pick:"player"}};
  for(const [game,opts] of Object.entries(options)){
    const result=await instantResult(game,opts,new FairRng(seed,"client",game));
    assert.ok(Number.isSafeInteger(result.payoutBP)&&result.payoutBP>=0,game);
    assert.ok(result.outcome&&typeof result.outcome==="object",game);
  }
});

test("Mines hides traps until round completes and rejects duplicate moves",async()=>{
  const state=await initialSession("mines",{mineCount:3},1000,new FairRng(newSeed(),"client","mines"));
  assert.equal(sessionView(state,"ACTIVE").mines,undefined);
  const safe=Array.from({length:25},(_,i)=>i).find(i=>!state.mines.includes(i));
  const move=moveSession(state,"select",safe);
  assert.equal(move.state,"ACTIVE");
  assert.ok(move.data.multiplierBP>10000);
  assert.throws(()=>moveSession(move.data,"select",safe),/unopened tile/);
  assert.ok(Array.isArray(sessionView(move.data,"WON").mines));
});

test("session games remain server-driven and validate moves",async()=>{
  for(const game of ["towers","chicken","hilo","blackjack","poker"]){
    const state=await initialSession(game,{},1000,new FairRng(newSeed(),"client",game));
    assert.equal(state.game,game);
    assert.ok(!("deck" in sessionView(state,"ACTIVE")));
  }
  await assert.rejects(()=>instantResult("dice",{target:101},new FairRng(newSeed(),"c","n")),/Choose a value/);
});
