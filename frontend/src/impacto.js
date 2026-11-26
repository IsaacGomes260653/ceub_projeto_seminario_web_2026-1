// Impacto evitado por peça reaproveitada, por categoria. São estimativas de produção de uma peça nova
// equivalente, as mesmas do projeto original do Ciranda. Categoria sem fator confiável não mostra número.
const ALGODAO = "Estimativa a partir de 14,1 kg de CO2e e 2.900 litros de água por quilo de algodão, do berço ao portão, vezes o peso típico da peça.";
const JEANS = "Estimativa a partir da avaliação de ciclo de vida da calça 501 da Levi Strauss (2015), só com as fases de produção.";

export const IMPACTO = {
  "Camisetas e blusas": { agua: 725, co2: 3.5, fonte: ALGODAO },
  "Camisas": { agua: 870, co2: 4.2, fonte: ALGODAO },
  "Vestidos": { agua: 1160, co2: 5.6, fonte: ALGODAO },
  "Saias": { agua: 870, co2: 4.2, fonte: ALGODAO },
  "Calças jeans": { agua: 2911, co2: 21, fonte: JEANS },
  "Jaquetas e casacos": { agua: 2320, co2: 11.3, fonte: ALGODAO },
};

const numero = (n, casas = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
export function impactoDe(categoria) {
  const f = IMPACTO[categoria];
  return f ? { agua: `${numero(f.agua)} L`, co2: `${numero(f.co2, 1)} kg`, fonte: f.fonte } : null;
}
