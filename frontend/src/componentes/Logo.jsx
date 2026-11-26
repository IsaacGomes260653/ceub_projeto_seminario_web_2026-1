// Marca do Ciranda nas cores do CEUB: o anel é a letra c e a roda, o ponto é a peça que entra.
export function Logo({ tamanho = 30, claro = false }) {
  const tinta = claro ? "#FFFFFF" : "#662C92";
  return (
    <span className="inline-flex items-center gap-2 font-titulo font-extrabold leading-none" style={{ color: tinta, fontSize: tamanho * 0.95, letterSpacing: "-0.05em" }}>
      <svg width={tamanho} height={tamanho} viewBox="-24 -24 48 48" aria-hidden="true" focusable="false">
        <circle r="14" fill="none" stroke={tinta} strokeWidth="9.5" strokeDasharray="67.2 20.76" transform="rotate(-2)" />
        <circle cx="9.9" cy="-9.9" r="5" fill={claro ? "#FDE100" : "#BF0087"} />
      </svg>
      ciranda
    </span>
  );
}
