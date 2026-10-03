import Casino from "@/components/casino";
import { GAME_IDS, type GameId } from "@/lib/galaxy/games";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
const titles:Record<GameId,string>={dice:"Dice",crash:"Crash",plinko:"Plinko",towers:"Towers",mines:"Mines",hilo:"Hi-Lo",blackjack:"Blackjack",coinflip:"Coinflip",chicken:"Chicken Road",limbo:"Limbo",wheel:"Wheel",keno:"Keno",roulette:"Roulette",baccarat:"Baccarat",poker:"Video Poker"};
export function generateStaticParams(){return GAME_IDS.map(slug=>({slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;return {title:titles[slug as GameId]?`Galaxy Bets ${titles[slug as GameId]} — Demo Play`:"Game not found",description:"Play the Galaxy Bets original with demo credits. No cash value. Adults 18+."};}
export default async function GamePage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;if(!GAME_IDS.includes(slug as GameId))notFound();return <Casino initialGame={slug as GameId}/>;}
