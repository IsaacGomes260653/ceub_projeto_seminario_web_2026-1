import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "../api.js";
import { carregar3D, MODELOS } from "../arara.js";
import { brl } from "../menu.js";

// Página de uma peça. As peças de cima giram em 3D quando o aparelho permite; as demais mostram a foto.
export function Peca() {
  const { id } = useParams();
  const { state } = useLocation();
  const [peca, setPeca] = useState(null);
  const [erro, setErro] = useState("");
  const [gira, setGira] = useState(false);
  const tela = useRef(null);
  const volta = `/catalogo${state?.de || ""}`;

  useEffect(() => {
    let vivo = true;
    setPeca(null); setErro(""); setGira(false);
    api.obter("/pecas", id).then((p) => { if (vivo) setPeca(p); }).catch((e) => { if (vivo) setErro(e.status === 404 ? "Esta peça não existe mais no catálogo." : e.message); });
    return () => { vivo = false; };
  }, [id]);

  useEffect(() => { if (peca) document.title = `${peca.titulo} · Ciranda`; }, [peca]);

  // O visor 3D entra por cima da foto. Se o 3D faltar ou falhar, a foto continua lá.
  const modelo = peca ? MODELOS[peca.foto] : null;
  useEffect(() => {
    if (!modelo) return undefined;
    let visor = null;
    let vivo = true;
    carregar3D().then((pode) => {
      if (!vivo || !pode || !tela.current) return;
      try { visor = window.Ciranda3D.visor(tela.current, { forma: "top", top: modelo, cor: "" }); if (visor) setGira(true); } catch { /* fica a foto */ }
    });
    return () => { vivo = false; if (visor) visor.destruir(); };
  }, [modelo]);

  if (erro) {
    return (
      <section aria-labelledby="peca-erro">
        <h1 id="peca-erro" className="titulo">Peça não encontrada</h1>
        <p role="alert">{erro}</p>
        <Link className="btn filled" to={volta}>Voltar ao catálogo</Link>
      </section>
    );
  }
  if (!peca) return <p role="status">Carregando…</p>;

  const detalhes = [["Marca", peca.marca], ["Tamanho", peca.tamanho], ["Categoria", peca.categoria], ["Conservação", peca.conservacao]].filter(([, v]) => v);
  return (
    <article className="peca-pagina" aria-labelledby="peca-titulo">
      <Link className="voltar" to={volta}><span aria-hidden="true">←</span> Voltar ao catálogo</Link>
      <div className="peca-grade">
        <div className="peca-palco">
          {peca.foto
            ? <img className={gira ? "oculta" : ""} src={`/fotos/${peca.foto}`} alt={gira ? "" : peca.titulo} width="720" height="900" />
            : <span className="sem-foto">Esta peça ainda não tem foto.</span>}
          {modelo && <canvas ref={tela} className={gira ? "" : "oculta"} tabIndex={gira ? 0 : -1} role="img" aria-label={`${peca.titulo} em 3D. Arraste ou use as setas para girar.`} />}
          {gira && <p className="peca-dica">Arraste para girar</p>}
        </div>
        <div className="peca-info">
          <h1 id="peca-titulo" className="titulo">{peca.titulo}</h1>
          <p className="peca-preco"><strong>{brl(peca.preco)}</strong> <span className={`situacao ${peca.situacao === "Disponível" ? "ok" : ""}`}>{peca.situacao}</span></p>
          <p className="peca-voltas"><strong>{peca.voltas}ª volta.</strong> {peca.voltas > 1 ? `Esta peça já passou por ${peca.voltas - 1} ${peca.voltas === 2 ? "armário" : "armários"} antes de chegar aqui.` : "Esta peça está na primeira volta pelo brechó."}</p>
          <dl className="peca-dados">
            {detalhes.map(([rotulo, valor]) => <div key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></div>)}
          </dl>
        </div>
      </div>
    </article>
  );
}
