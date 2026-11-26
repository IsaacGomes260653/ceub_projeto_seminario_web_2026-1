import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { litros, quilos } from "../menu.js";

const CORES = ["#662C92", "#EC0089", "#FDE100", "#BF0087", "#43054E"];
// Só anima onde o navegador sabe animar e a pessoa não pediu menos movimento.
const podeAnimar = () => typeof document.body.animate === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Confetes nas cores do CEUB, saindo do meio da tela. Cada um se remove quando a animação termina.
function soltarConfetes() {
  for (let i = 0; i < 44; i++) {
    const c = document.createElement("span");
    const fita = i % 4 === 0;
    c.className = "confete";
    c.setAttribute("aria-hidden", "true");
    Object.assign(c.style, { width: fita ? "10px" : "8px", height: fita ? "16px" : "8px", background: CORES[i % CORES.length], borderRadius: fita ? "2px" : "50%", left: `${window.innerWidth / 2}px`, top: `${window.innerHeight / 2 - 80}px` });
    document.body.appendChild(c);
    const angulo = Math.random() * Math.PI * 2;
    const forca = 160 + Math.random() * 320;
    const dx = Math.cos(angulo) * forca;
    const dy = Math.sin(angulo) * forca - 180;
    c.animate([
      { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 720}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx * 1.15}px, ${dy + 440}px) rotate(${Math.random() * 1080}deg)`, opacity: 0 },
    ], { duration: 1700 + Math.random() * 900, easing: "cubic-bezier(.2, .7, .4, 1)" }).onfinish = () => c.remove();
  }
}

// Número que sobe de zero até o valor, para a pessoa ver o que a compra somou.
function Subindo({ ate, formato }) {
  const [valor, setValor] = useState(() => (podeAnimar() ? 0 : ate));
  useEffect(() => {
    if (!podeAnimar()) { setValor(ate); return undefined; }
    let quadro;
    const inicio = performance.now();
    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / 1200);
      setValor(ate * (1 - (1 - t) ** 3));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [ate]);
  return formato(valor);
}

// Tela de comprado: aparece uma vez, logo depois que o Pix simulado é confirmado.
export function Festa({ pedido, aoFechar }) {
  const principal = useRef(null);
  const primeira = pedido.itens[0];
  useEffect(() => {
    const antes = document.activeElement;
    principal.current?.focus();
    if (podeAnimar()) soltarConfetes();
    const tecla = (e) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("keydown", tecla); antes?.focus?.(); };
  }, [aoFechar]);

  return (
    <div className="festa" role="dialog" aria-modal="true" aria-labelledby="festa-t">
      <div className="festa-caixa">
        <div className="festa-foto">
          {primeira.foto ? <img src={`/fotos/${primeira.foto}`} alt="" width="360" height="450" /> : <span aria-hidden="true" />}
          <p className="festa-carimbo"><strong>+1</strong> volta</p>
        </div>
        <h2 id="festa-t">Pix confirmado</h2>
        <p className="festa-frase">{pedido.itens.length === 1 ? `${primeira.titulo} ganhou mais uma volta na roda.` : `As ${pedido.itens.length} peças ganharam mais uma volta na roda.`}</p>
        <dl className="festa-numeros">
          <div><dd><Subindo ate={pedido.agua} formato={(v) => litros(Math.round(v))} /></dd><dt>de água poupada</dt></div>
          <div><dd><Subindo ate={pedido.co2} formato={quilos} /></dd><dt>de carbono evitado</dt></div>
          <div><dd><Subindo ate={pedido.pontos} formato={(v) => Math.round(v)} /></dd><dt>pontos ganhos</dt></div>
        </dl>
        <button ref={principal} type="button" className="btn filled" onClick={aoFechar}>Acompanhar pedido</button>
        <Link className="festa-outro" to="/catalogo">Continuar comprando</Link>
      </div>
    </div>
  );
}
