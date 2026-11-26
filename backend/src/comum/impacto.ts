// Impacto evitado quando uma peça usada substitui a produção de uma nova, por categoria.
// Água em litros, CO2 em kg, pontos do programa. São os fatores do Ciranda original:
// algodão a 14,1 kg de CO2e e 2.900 L de água por quilo, e a avaliação de ciclo de vida da calça 501.
export const IMPACTO: Record<string, { agua: number; co2: number; pontos: number }> = {
  "Camisetas e blusas": { agua: 725, co2: 3.5, pontos: 35 },
  "Camisas": { agua: 870, co2: 4.2, pontos: 42 },
  "Vestidos": { agua: 1160, co2: 5.6, pontos: 56 },
  "Saias": { agua: 870, co2: 4.2, pontos: 42 },
  "Calças jeans": { agua: 2911, co2: 21, pontos: 210 },
  "Jaquetas e casacos": { agua: 2320, co2: 11.3, pontos: 113 },
};

// Categoria sem fator confiável soma zero, em vez de um número inventado.
export function somarImpacto(categorias: string[]) {
  const t = { agua: 0, co2: 0, pontos: 0 };
  for (const c of categorias) {
    const f = IMPACTO[c];
    if (f) { t.agua += f.agua; t.co2 += f.co2; t.pontos += f.pontos; }
  }
  return { agua: t.agua, co2: Math.round(t.co2 * 10) / 10, pontos: t.pontos };
}
