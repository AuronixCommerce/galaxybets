export function GalaxyMark({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? "brandCompact" : ""}`} aria-label="Galaxy Bets">
    <span className="brandOrb"><span className="brandStar">✦</span></span>
    {!compact && <span className="brandText"><strong>GALAXY</strong><em>BETS</em></span>}
  </div>;
}
