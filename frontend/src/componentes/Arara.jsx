import { useEffect, useRef, useState } from "react";
import { carregar3D, MODELOS, naArara } from "../arara.js";
import { brl } from "../menu.js";

// A arara é um enfeite com função: mostra as mesmas peças da lista, que continua logo abaixo
// para quem usa leitor de tela, teclado ou um aparelho sem WebGL.
export function Arara({ pecas, aoEscolher }) {
  const caixa = useRef(null);
  const [estado, setEstado] = useState("carregando");
  const escolhidas = naArara(pecas);
  const chave = escolhidas.map((p) => p.id).join(",");

  useEffect(() => {
    if (!escolhidas.length) return undefined;
    let desmontar = null;
    let vivo = true;
    carregar3D().then((pode) => {
      if (!vivo) return;
      if (!pode) { setEstado("sem3d"); return; }
      const estreito = window.innerWidth < 700;
      const itens = escolhidas.map((p) => ({ name: `${p.titulo} · ${brl(p.preco)}`, ...MODELOS[p.foto] }));
      try {
        desmontar = window.Ciranda3D.arara(caixa.current, itens, (i) => aoEscolher(escolhidas[i]), {
          size: estreito ? 0.42 : 0.56, gap: estreito ? 4 : 14, showCaption: !estreito,
          breeze: window.matchMedia?.("(hover: none), (prefers-reduced-motion: reduce)")?.matches ? 0 : 0.5,
        });
        setEstado("pronta");
      } catch { setEstado("sem3d"); }
    });
    return () => { vivo = false; if (desmontar) desmontar(); };
  }, [chave]);

  if (!escolhidas.length || estado === "sem3d") return null;
  return (
    <section className="arara" aria-label="Arara 3D">
      <p className="arara-dica">
        <strong>Passe a mão na arara.</strong> {escolhidas.length} {escolhidas.length === 1 ? "peça gira" : "peças giram"} aqui. Toque em uma para abrir.
      </p>
      <div ref={caixa} className="arara-palco" data-estado={estado} />
    </section>
  );
}
