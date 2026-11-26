// Arara 3D: as peças de cima (camiseta, camisa, moletom, jaqueta) giram numa arara de verdade.
// O pacote 3D é pesado, então só é baixado quando o catálogo abre e o aparelho tem WebGL.
const P = (kind, colour, print) => (print ? { kind, colour, print } : { kind, colour });

// Cada foto do catálogo corresponde a um modelo 3D. Peça sem modelo (calça, saia, tênis) fica só na lista.
export const MODELOS = {
  "camiseta-listrada.webp": P("tee", "#3E5C76", { kind: "stripes", colour: "#F3F0E8" }),
  "camiseta-verde.webp": P("tee", "#7C8A6A"),
  "camiseta-bolso.webp": P("tee", "#F3F3F4", { kind: "pocket" }),
  "camiseta-preta.webp": P("tee", "#1B1B1D"),
  "camiseta-flor.webp": P("tee", "#F4F4F5", { kind: "flowers", text: "Flor de Maio", ink: "#1F1F24" }),
  "camiseta-vinho.webp": P("tee", "#9A3F33"),
  "camisa-linho.webp": P("shirt", "#D8CFBF"),
  "camisa-estampada.webp": P("shirt", "#2F3631", { kind: "pattern", colours: ["#20251F", "#E6DCC4", "#C7A46C", "#9FAE86", "#BF7350"] }),
  "moletom-clube.webp": P("crewneck", "#2C4844", { kind: "serif", lines: ["Clube", "da", "Roda"], ink: "#F1EDE2" }),
  "trico-caramelo.webp": P("crewneck", "#C9A27E"),
  "jaqueta-jeans.webp": P("crewneck", "#5C7894", { kind: "jacket", stitch: "#D9892B" }),
  "jaqueta-caqui.webp": P("crewneck", "#8A7A55", { kind: "jacket", stitch: "#53492F" }),
};

export const LIMITE = 10;
export const naArara = (pecas) => (pecas || []).filter((p) => MODELOS[p.foto]).slice(0, LIMITE);

export function tem3D(janela = window) {
  try { return !!(janela.Ciranda3D && janela.Ciranda3D.disponivel()); } catch { return false; }
}

let carregando = null;
// Baixa o pacote 3D uma única vez. Resolve com true se a arara puder ser usada.
export function carregar3D(doc = document, janela = window) {
  if (janela.Ciranda3D) return Promise.resolve(tem3D(janela));
  if (!carregando) {
    carregando = new Promise((resolver) => {
      const estilo = doc.createElement("link");
      estilo.rel = "stylesheet";
      estilo.href = "/arara3d/tw.css";
      doc.head.appendChild(estilo);
      const script = doc.createElement("script");
      script.src = "/arara3d/ciranda3d.js";
      script.async = true;
      script.onload = () => resolver(tem3D(janela));
      script.onerror = () => { carregando = null; resolver(false); };
      doc.head.appendChild(script);
    });
  }
  return carregando;
}
export function esquecer3D() { carregando = null; }
