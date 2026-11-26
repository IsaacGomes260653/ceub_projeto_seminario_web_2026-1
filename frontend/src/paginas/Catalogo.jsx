import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { brl, CATEGORIAS } from "../menu.js";
import { Arara } from "../componentes/Arara.jsx";

export function Catalogo() {
  const [pecas, setPecas] = useState(null);
  const [erro, setErro] = useState("");
  // Busca e categoria ficam na URL: o link pode ser compartilhado e o botão Voltar funciona.
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const categoria = params.get("categoria") || "";
  const filtrar = (chave, valor) => setParams((atual) => {
    const novo = new URLSearchParams(atual);
    if (valor) novo.set(chave, valor); else novo.delete(chave);
    return novo;
  }, { replace: true });
  // O campo de busca tem estado próprio, para a digitação nunca atrasar. A URL recebe o texto
  // quando a pessoa para de digitar, e é a URL que dispara a consulta.
  const [texto, setTexto] = useState(q);
  const enviado = useRef(q);
  useEffect(() => {
    if (texto === enviado.current) return undefined;
    const espera = setTimeout(() => { enviado.current = texto; filtrar("q", texto); }, 250);
    return () => clearTimeout(espera);
  }, [texto]);
  // Se a URL mudar por fora (botão Voltar, Limpar filtros), o campo acompanha.
  useEffect(() => { if (q !== enviado.current) { enviado.current = q; setTexto(q); } }, [q]);
  const setCategoria = (v) => filtrar("categoria", v);

  useEffect(() => {
    let vivo = true;
    api.listar("/pecas", { q, categoria })
      .then((r) => { if (vivo) { setPecas(r); setErro(""); } })
      .catch((e) => { if (vivo) { setPecas([]); setErro(e.message); } });
    return () => { vivo = false; };
  }, [q, categoria]);

  // A peça escolhida na arara ganha destaque na lista, e o foco vai até ela.
  const [destaque, setDestaque] = useState(null);
  const escolher = (peca) => {
    setDestaque(peca.id);
    const cartao = document.getElementById(`peca-${peca.id}`);
    if (cartao) { cartao.scrollIntoView?.({ behavior: "smooth", block: "center" }); cartao.focus({ preventScroll: true }); }
  };

  return (
    <section aria-labelledby="catalogo-titulo">
      <h1 id="catalogo-titulo" className="titulo">Catálogo</h1>
      <p className="mt-0 text-ceub-cinza">Peças únicas, cada uma com o número de voltas que já deu.</p>
      <Arara pecas={pecas} aoEscolher={escolher} />
      <form className="painel grid sm:grid-cols-[1fr_16rem] gap-4 mb-6" role="search" aria-label="Buscar peças" onSubmit={(e) => e.preventDefault()}>
        <div className="campo">
          <label htmlFor="busca">Buscar por peça ou marca</label>
          <input id="busca" name="q" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={60} autoComplete="off" spellCheck={false} placeholder="Ex.: jaqueta, Levi’s…" />
        </div>
        <div className="campo">
          <label htmlFor="filtro-categoria">Categoria</label>
          <select id="filtro-categoria" name="categoria" className="browser-default" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas</option>
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </form>
      {erro && <p className="erro-geral" role="alert">{erro}</p>}
      <p role="status" aria-live="polite" className="text-sm text-ceub-cinza">{pecas === null ? "Carregando…" : `${pecas.length} ${pecas.length === 1 ? "peça encontrada" : "peças encontradas"}`}</p>
      {pecas === null && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="esqueleto"><i className="f" /><i className="l" /><i className="l c" /></div>)}
        </div>
      )}
      {pecas !== null && pecas.length === 0 && !erro && (
        <div className="vazio">
          <strong>{q || categoria ? "Nenhuma peça com esse filtro" : "O catálogo ainda está vazio"}</strong>
          {q || categoria ? "Tente outro nome, outra marca ou todas as categorias." : "Assim que um fornecedor cadastrar uma peça, ela aparece aqui."}
          {(q || categoria) && <div><button type="button" className="btn tonal" onClick={() => setParams({}, { replace: true })}>Limpar filtros</button></div>}
        </div>
      )}
      <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 list-none p-0 m-0">
        {(pecas || []).map((p, i) => (
          <li key={p.id} id={`peca-${p.id}`} tabIndex="-1" className={`card peca entra m-0 ${destaque === p.id ? "destaque" : ""}`} style={{ "--i": i }}>
            <div className="card-image foto">
              {p.foto ? <img src={`/fotos/${p.foto}`} alt="" loading={i < 4 ? "eager" : "lazy"} decoding="async" width="480" height="600" /> : <span aria-hidden="true" className="sem-foto">sem foto</span>}
              <span className="voltas">{p.voltas}ª volta</span>
            </div>
            <div className="card-content">
              <h2 className="nome">{p.titulo}</h2>
              <p className="m-0 text-sm text-ceub-cinza">{[p.marca, p.tamanho, p.conservacao].filter(Boolean).join(" · ")}</p>
              <p className="m-0 mt-2 flex items-center justify-between gap-2">
                <strong className="preco">{brl(p.preco)}</strong>
                <span className={`situacao ${p.situacao === "Disponível" ? "ok" : ""}`}>{p.situacao}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
