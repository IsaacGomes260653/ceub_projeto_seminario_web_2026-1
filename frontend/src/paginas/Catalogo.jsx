import { useEffect, useState } from "react";
import { api } from "../api.js";
import { brl, CATEGORIAS } from "../menu.js";

export function Catalogo() {
  const [pecas, setPecas] = useState(null);
  const [erro, setErro] = useState("");
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("");

  useEffect(() => {
    // Espera a pessoa parar de digitar antes de buscar.
    const espera = setTimeout(() => {
      api.listar("/pecas", { q, categoria }).then((r) => { setPecas(r); setErro(""); }).catch((e) => { setPecas([]); setErro(e.message); });
    }, q ? 250 : 0);
    return () => clearTimeout(espera);
  }, [q, categoria]);

  return (
    <section aria-labelledby="catalogo-titulo">
      <h1 id="catalogo-titulo" className="titulo">Catálogo</h1>
      <p className="mt-0 text-ceub-cinza">Peças únicas, cada uma com o número de voltas que já deu.</p>
      <form className="painel grid sm:grid-cols-[1fr_16rem] gap-4 mb-6" role="search" aria-label="Buscar peças" onSubmit={(e) => e.preventDefault()}>
        <div className="campo">
          <label htmlFor="busca">Buscar por peça ou marca</label>
          <input id="busca" type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} />
        </div>
        <div className="campo">
          <label htmlFor="filtro-categoria">Categoria</label>
          <select id="filtro-categoria" className="browser-default" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas</option>
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </form>
      {erro && <p className="erro-geral" role="alert">{erro}</p>}
      <p role="status" aria-live="polite" className="text-sm text-ceub-cinza">{pecas === null ? "Carregando" : `${pecas.length} ${pecas.length === 1 ? "peça encontrada" : "peças encontradas"}`}</p>
      <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 list-none p-0 m-0">
        {(pecas || []).map((p) => (
          <li key={p.id} className="card peca m-0">
            <div className="card-image foto">
              {p.foto ? <img src={`/fotos/${p.foto}`} alt="" loading="lazy" width="480" height="600" /> : <span aria-hidden="true" className="sem-foto">sem foto</span>}
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
