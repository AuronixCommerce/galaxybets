import Link from "next/link";
import { ArrowRight, Dices, Rocket, CircleDot, Layers3, Bomb, Spade, CircleDollarSign, Sparkles, Trophy, ShieldCheck } from "lucide-react";

const games = [
  { name:"Dice", href:"/originals/dice", icon:Dices, tone:"violet", desc:"Holographic roll chamber" },
  { name:"Crash", href:"/#games", icon:Rocket, tone:"blue", desc:"Hyperdrive multiplier" },
  { name:"Plinko", href:"/#games", icon:CircleDot, tone:"cyan", desc:"Cosmic gravity board" },
  { name:"Towers", href:"/#games", icon:Layers3, tone:"magenta", desc:"Ascend the alien tower" },
  { name:"Mines", href:"/originals/mines", icon:Bomb, tone:"amber", desc:"Mine an asteroid field" },
  { name:"Blackjack", href:"/#games", icon:Spade, tone:"green", desc:"Holographic table" },
  { name:"Coinflip", href:"/originals/coinflip", icon:CircleDollarSign, tone:"indigo", desc:"Galaxy vs Nova" },
];

export default function Home() {
  return <div className="pageWrap">
    <section className="hero">
      <div className="heroNoise"/><div className="heroOrbit orbitOne"/><div className="heroOrbit orbitTwo"/><div className="heroPlanet"/>
      <div className="heroContent"><div className="eyebrow"><Sparkles size={15}/> GALAXY ORIGINALS</div><h1>Explore the <span>Galaxy</span><br/>of Games.</h1><p>Original demo-credit games with server-verified outcomes, cinematic motion and a clean spaceborne interface.</p><div className="heroButtons"><Link href="/originals/dice" className="primaryBtn">PLAY NOW <ArrowRight size={17}/></Link><a href="#originals" className="ghostBtn">EXPLORE ORIGINALS</a></div></div>
      <div className="heroStat"><span>DEMO MODE</span><strong>10,000 GC</strong><small>No cash value</small></div>
    </section>

    <section className="strip"><div><Trophy/> <span><b>Daily Drops</b><small>Claim demo rewards</small></span></div><div><Sparkles/><span><b>Provably Fair</b><small>Verify every result</small></span></div><div><ShieldCheck/><span><b>Server Verified</b><small>Wallet & games protected</small></span></div></section>

    <section id="originals" className="section"><div className="sectionHead"><div><span className="sectionKicker">GALAXY BETS</span><h2>Originals</h2></div><a href="#games">View all <ArrowRight size={15}/></a></div><div className="gameGrid">{games.map(({name,href,icon:Icon,tone,desc}) => <Link href={href} className={`gameCard ${tone}`} key={name}><div className="gameArt"><div className="artRing"/><Icon size={50}/><span className="artSpark">✦</span></div><div className="gameMeta"><span><strong>{name}</strong><small>{desc}</small></span><span className="playDot">▶</span></div></Link>)}</div></section>

    <section id="games" className="section compactSection"><div className="sectionHead"><div><span className="sectionKicker">COMING NEXT</span><h2>More Originals</h2></div></div><div className="comingRow">{["Chicken Road","Hi-Lo","Limbo","Wheel","Keno","Roulette","Baccarat","Video Poker"].map(x=><div className="comingCard" key={x}><span>{x}</span><small>Engine queued</small></div>)}</div></section>

    <section id="rewards" className="vipBanner"><div><span className="sectionKicker">GALAXY REWARDS</span><h2>Play. Progress. Reach Supernova.</h2><p>Demo-only VIP progression, daily credits and challenges — designed to reward activity without real-money transactions.</p></div><div className="vipBadge"><span>VIP 01</span><strong>EXPLORER</strong><div className="vipProgress"><i/></div><small>0 / 1,000 XP</small></div></section>

    <footer id="responsible" className="footer"><div><b>GALAXY BETS</b><span>Demo-credit gaming. 18+ only.</span></div><p>Galaxy Credits have no cash value. Real-money deposits and withdrawals are disabled.</p></footer>
  </div>;
}
