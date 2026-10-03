import Casino from "@/components/casino";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
const views=["bets","favorites","rewards","fairness","responsible","support","account"] as const;
type PageView=typeof views[number];
export function generateStaticParams(){return views.map(view=>({view}));}
export async function generateMetadata({params}:{params:Promise<{view:string}>}):Promise<Metadata>{const {view}=await params;return {title:`${view.charAt(0).toUpperCase()+view.slice(1)} — Galaxy Bets`,robots:["bets","favorites","rewards","account"].includes(view)?{index:false,follow:false}:undefined};}
export default async function ViewPage({params}:{params:Promise<{view:string}>}){const {view}=await params;if(!views.includes(view as PageView))notFound();return <Casino initialView={view as PageView}/>;}
