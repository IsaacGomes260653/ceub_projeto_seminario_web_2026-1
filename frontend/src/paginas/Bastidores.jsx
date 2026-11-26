import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Espera, usarDados } from "../componentes/usarDados.jsx";
import { brl, litros, quilos } from "../menu.js";
import { useSessao } from "../sessao.jsx";

const PROXIMA = { "Pago": "Em separação", "Em separação": "Enviado", "Enviado": "Entregue" };

// Fila de consignação: aprovar coloca a peça no catálogo, recusar pede um motivo que a pessoa vai ler.
function Fila({ aoMudar }) {
  const { dados, erro, carregar } = usarDados(() => api.listar("/consignacoes", { fila: 1 }));
  const [recusando, setRecusando] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [falha, setFalha] = useState("");
  const [aviso, setAviso] = useState("");
  const depois = (texto) => { setAviso(texto); setRecusando(null); setMotivo(""); setFalha(""); aoMudar(); return carregar(); };
  const aprovar = (p) => api.acao(`/consignacoes/${p.id}/aprovar`).then(() => depois(`${p.titulo} entrou no catálogo.`)).catch((e) => setAviso(e.message));
  const recusar = (e, p) => {
    e.preventDefault();
    api.acao(`/consignacoes/${p.id}/recusar`, { motivo }).then(() => depois(`${p.titulo} foi recusada.`)).catch((erroApi) => { setFalha(erroApi.detalhes?.motivo || erroApi.message); document.getElementById(`motivo-${p.id}`)?.focus(); });
  };

  return (
    <section aria-labelledby="fila-t" className="mb-10">
      <h2 id="fila-t" className="subtitulo">Peças esperando análise</h2>
      <p className="aviso" role="status" aria-live="polite">{aviso}</p>
      {!dados ? <Espera erro={erro} aoTentar={carregar} /> : dados.length === 0 ? <p className="painel">Nenhuma peça esperando. A fila está em dia.</p> : (
        <ul className="linhas">
          {dados.map((p) => (
            <li key={p.id}>
              <div className="linha-texto">
                <span className="forte">{p.titulo}</span>
                <span>{[p.marca, p.tamanho, p.conservacao].filter(Boolean).join(" · ")}</span>
                <span>Enviada por {p.dono}</span>
              </div>
              <strong className="linha-valor">{brl(p.preco)}</strong>
              {recusando === p.id ? (
                <form className="recusa" onSubmit={(e) => recusar(e, p)} noValidate>
                  <label htmlFor={`motivo-${p.id}`}>Motivo da recusa</label>
                  <input id={`motivo-${p.id}`} value={motivo} maxLength={200} autoFocus aria-invalid={falha ? "true" : undefined} aria-describedby={falha ? `motivo-erro-${p.id}` : undefined} onChange={(e) => setMotivo(e.target.value)} />
                  {falha && <p id={`motivo-erro-${p.id}`} className="erro" role="alert">{falha}</p>}
                  <div className="flex gap-2">
                    <button type="submit" className="btn btn-small perigo">Recusar peça</button>
                    <button type="button" className="btn btn-small outlined" onClick={() => { setRecusando(null); setFalha(""); }}>Voltar</button>
                  </div>
                </form>
              ) : (
                <span className="flex gap-2">
                  <button type="button" className="btn btn-small filled" aria-label={`Aprovar ${p.titulo}`} onClick={() => aprovar(p)}>Aprovar</button>
                  <button type="button" className="btn btn-small outlined" aria-label={`Recusar ${p.titulo}`} onClick={() => { setRecusando(p.id); setMotivo(""); setFalha(""); setAviso(""); }}>Recusar</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Bastidores: o que vendeu, o que o brechó deve repassar e os pedidos que precisam andar.
export function Bastidores() {
  const { pode } = useSessao();
  const resumo = usarDados(() => api.listar("/bastidores"));
  const pedidos = usarDados(() => api.listar("/pedidos", { todos: 1 }));
  const [aviso, setAviso] = useState("");
  const avancar = (p) => api.acao(`/pedidos/${p.id}/avancar`)
    .then((novo) => { setAviso(`Pedido ${p.id} agora está em: ${novo.situacao}.`); return Promise.all([pedidos.carregar(), resumo.carregar()]); })
    .catch((e) => { setAviso(e.message); pedidos.carregar(); });
  const r = resumo.dados;

  return (
    <section aria-labelledby="bastidores-t">
      <h1 id="bastidores-t" className="titulo">Bastidores</h1>
      <p className="m-0 mb-6 text-ceub-cinza max-w-2xl">O que o brechó vendeu, o que deve repassar e o que ainda precisa de alguém.</p>
      {!r ? <Espera erro={resumo.erro} aoTentar={resumo.carregar} /> : (
        <>
          <dl className="numeros">
            <div><dt>Vendido</dt><dd>{brl(r.faturamento)}</dd></div>
            <div><dt>A repassar</dt><dd>{brl(r.repasseDevido)}</dd></div>
            <div><dt>Fica no brechó</dt><dd>{brl(r.ficaNoBrecho)}</dd></div>
            <div><dt>Peças à venda</dt><dd>{r.pecas["Disponível"] || 0}</dd></div>
          </dl>
          <p className="respiro text-ceub-cinza">As vendas já pouparam {litros(r.agua)} de água e {quilos(r.co2)} de carbono, e distribuíram {r.pontos} pontos.</p>
        </>
      )}

      {pode("consignacao.aprovar") && <Fila aoMudar={resumo.carregar} />}

      <section aria-labelledby="andar-t" className="mb-10">
        <h2 id="andar-t" className="subtitulo">Pedidos</h2>
        <p className="aviso" role="status" aria-live="polite">{aviso}</p>
        {!pedidos.dados ? <Espera erro={pedidos.erro} aoTentar={pedidos.carregar} /> : pedidos.dados.length === 0 ? <p className="painel">Nenhum pedido ainda. Quando alguém fechar a sacola, o pedido aparece aqui.</p> : (
          <ul className="linhas">
            {pedidos.dados.map((p) => (
              <li key={p.id}>
                <div className="linha-texto">
                  <Link to={`/pedidos/${p.id}`}>Pedido {p.id}</Link>
                  <span>{p.cliente} · {p.itens.length === 1 ? "1 peça" : `${p.itens.length} peças`}</span>
                </div>
                <strong className="linha-valor">{brl(p.total)}</strong>
                <span className={`situacao ${PROXIMA[p.situacao] || p.situacao === "Entregue" ? "ok" : ""}`}>{p.situacao}</span>
                {PROXIMA[p.situacao] && <button type="button" className="btn btn-small tonal" aria-label={`Avançar pedido ${p.id} para ${PROXIMA[p.situacao]}`} onClick={() => avancar(p)}>Marcar: {PROXIMA[p.situacao]}</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {r && r.repasses.length > 0 && (
        <section aria-labelledby="repasses-t">
          <h2 id="repasses-t" className="subtitulo">Repasses por pessoa</h2>
          <ul className="linhas">
            {r.repasses.map((l) => (
              <li key={l.dono}>
                <div className="linha-texto"><span className="forte">{l.dono}</span><span>{l.pecas === 1 ? "1 peça vendida" : `${l.pecas} peças vendidas`}</span></div>
                <strong className="linha-valor">{brl(l.valor)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
