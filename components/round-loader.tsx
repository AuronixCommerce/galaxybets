export default function RoundLoader({ small = false }: { small?: boolean }) {
  return <span className={`gb-round-loader${small ? " small" : ""}`} aria-hidden="true">
    {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--segment": index } as React.CSSProperties}/>)}
  </span>;
}
