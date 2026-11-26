import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { Festa } from "../componentes/Festa.jsx";
import { Espera, usarDados } from "../componentes/usarDados.jsx";
import { brl, dia, hora, litros, quilos } from "../menu.js";
import { useSessao } from "../sessao.jsx";

const ETAPAS = ["Pago", "Em separação", "Enviado", "Entregue"];
const ENCERRADO = ["Cancelado", "Expirado"];

// Sacola: cada peça é única, então colocar na sacola reserva a peça por 30 minutos.
export function Sacola() {
  const navegar = useNavigate();
  const { dados, erro, carregar, setDados } = usarDados(() => api.listar("/sacola"));
  const [falha, setFalha] = useState("");
  const [fechando, setFechando] = useState(false);
  if (!dados) return <section aria-labelledby="sacola-t"><h1 id="sacola-t" className="titulo">Sacola</h1><Espera erro={erro} aoTentar={carregar} /></section>;

  const tirar = (id) => api.remover("/sacola", id).then(setDados).catch((e) => { setFalha(e.message); carregar(); });
  async function fechar() {
    setFechando(true); setFalha("");
    try { const p = await api.acao("/pedidos"); navegar(`/pedidos/${p.id}`); } catch (e) { setFalha(e.message); setFechando(false); carregar(); }
  }

  return (
    <section aria-labelledby="sacola-t">
      <h1 id="sacola-t" className="titulo">Sacola</h1>
      <p className="m-0 mb-6 text-ceub-cinza max-w-2xl">Cada peça é única. Enquanto está na sua sacola, ninguém mais consegue comprar.</p>
      {falha && <p className="erro-geral" role="alert">{falha}</p>}
      {dados.itens.length === 0 ? (
        <div className="vazio">
          <strong>Sua sacola está vazia.</strong>
          <p>Escolha uma peça no catálogo. Ela fica reservada para você por 30 minutos.</p>
          <Link className="btn filled" to="/catalogo">Ver o catálogo</Link>
        </div>
      ) : (
        <>
          <ul className="linhas">
            {dados.itens.map((i) => (
              <li key={i.id}>
                {i.foto ? <img src={`/fotos/${i.foto}`} alt="" width="64" height="80" loading="lazy" /> : <span className="mini-sem-foto" aria-hidden="true" />}
                <div className="linha-texto">
                  <Link to={`/catalogo/${i.id}`}>{i.titulo}</Link>
                  <span>{[i.marca, i.tamanho].filter(Boolean).join(" · ")}</span>
                  <span>Reservada para você até {hora(i.reservadaAte)}</span>
                </div>
                <strong className="linha-valor">{brl(i.preco)}</strong>
                <button type="button" className="btn btn-small outlined" aria-label={`Tirar ${i.titulo} da sacola`} onClick={() => tirar(i.id)}>Tirar</button>
              </li>
            ))}
          </ul>
          <div className="fecho">
            <p><span>Total</span> <strong>{brl(dados.total)}</strong></p>
            <button type="button" className="btn filled" disabled={fechando} onClick={fechar}>{fechando ? "Fechando…" : "Fechar pedido"}</button>
          </div>
        </>
      )}
    </section>
  );
}

// Lista dos pedidos de quem está logado, com o que as compras já pouparam.
export function Pedidos() {
  const pedidos = usarDados(() => api.listar("/pedidos"));
  const impacto = usarDados(() => api.listar("/impacto"));
  return (
    <section aria-labelledby="pedidos-t">
      <h1 id="pedidos-t" className="titulo">Pedidos</h1>
      {impacto.dados && impacto.dados.pedidos > 0 && (
        <dl className="numeros" aria-label="O que suas compras já pouparam">
          <div><dt>Pontos</dt><dd>{impacto.dados.pontos}</dd></div>
          <div><dt>Água poupada</dt><dd>{litros(impacto.dados.agua)}</dd></div>
          <div><dt>Carbono evitado</dt><dd>{quilos(impacto.dados.co2)}</dd></div>
        </dl>
      )}
      {!pedidos.dados ? <Espera erro={pedidos.erro} aoTentar={pedidos.carregar} /> : pedidos.dados.length === 0 ? (
        <div className="vazio">
          <strong>Você ainda não fez nenhum pedido.</strong>
          <p>Cada compra soma pontos e mostra quanta água e carbono a peça poupou.</p>
          <Link className="btn filled" to="/catalogo">Ver o catálogo</Link>
        </div>
      ) : (
        <ul className="linhas">
          {pedidos.dados.map((p) => (
            <li key={p.id}>
              <div className="linha-texto">
                <Link to={`/pedidos/${p.id}`}>Pedido {p.id}</Link>
                <span>{p.itens.length === 1 ? p.itens[0].titulo : `${p.itens.length} peças`} · {dia(p.criadoEm)}</span>
              </div>
              <strong className="linha-valor">{brl(p.total)}</strong>
              <span className={`situacao ${ETAPAS.includes(p.situacao) ? "ok" : ""}`}>{p.situacao}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Um pedido: Pix simulado enquanto espera pagamento, depois a linha do tempo até a entrega.
export function Pedido() {
  const { id } = useParams();
  const { usuario } = useSessao();
  const { dados: p, erro, carregar, setDados } = usarDados(() => api.obter("/pedidos", id), [id]);
  const [falha, setFalha] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  // A tela de comprado só aparece quando o pagamento acontece nesta visita, não ao reabrir o pedido.
  const [festa, setFesta] = useState(false);
  const fecharFesta = useCallback(() => setFesta(false), []);
  if (!p) return <section aria-labelledby="pedido-t"><h1 id="pedido-t" className="titulo">Pedido {id}</h1><Espera erro={erro} aoTentar={carregar} /></section>;

  const agir = async (acao) => {
    setOcupado(true); setFalha("");
    try { setDados(await api.acao(`/pedidos/${p.id}/${acao}`)); if (acao === "pagar") setFesta(true); } catch (e) { setFalha(e.message); carregar(); } finally { setOcupado(false); }
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(p.pix); setCopiado(true); } catch { setFalha("Não deu para copiar. Selecione o código e copie à mão."); } };
  const meu = p.usuarioId === usuario.id;
  const feito = ETAPAS.indexOf(p.situacao);

  return (
    <article aria-labelledby="pedido-t" className="pedido">
      <Link className="voltar" to={meu ? "/pedidos" : "/bastidores"}><span aria-hidden="true">←</span> {meu ? "Voltar aos pedidos" : "Voltar aos bastidores"}</Link>
      {festa && <Festa pedido={p} aoFechar={fecharFesta} />}
      <h1 id="pedido-t" className="titulo">Pedido {p.id}</h1>
      <p className="peca-preco"><strong>{brl(p.total)}</strong> <span className={`situacao ${feito >= 0 ? "ok" : ""}`}>{p.situacao}</span></p>
      {!meu && <p className="m-0 mb-4 text-ceub-cinza">Cliente: {p.cliente}</p>}
      {falha && <p className="erro-geral" role="alert">{falha}</p>}

      {p.situacao === "Aguardando pagamento" && meu && (
        <section className="painel pix" aria-labelledby="pix-t">
          <h2 id="pix-t" className="subtitulo">Pague com Pix até {hora(p.expiraEm)}</h2>
          <p className="ajuda">Este Pix é simulado. Nenhum dinheiro sai da sua conta: o botão abaixo faz o papel do banco.</p>
          <p className="codigo"><code>{p.pix}</code></p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn filled" disabled={ocupado} onClick={() => agir("pagar")}>Confirmar pagamento simulado</button>
            <button type="button" className="btn tonal" onClick={copiar}>{copiado ? "Código copiado" : "Copiar código"}</button>
            <button type="button" className="btn outlined" disabled={ocupado} onClick={() => agir("cancelar")}>Cancelar pedido</button>
          </div>
          <p className="sr-only" role="status">{copiado ? "Código copiado." : ""}</p>
        </section>
      )}
      {ENCERRADO.includes(p.situacao) && (
        <p className="painel">{p.situacao === "Expirado" ? "A reserva venceu antes do pagamento e as peças voltaram ao catálogo." : "Você cancelou este pedido e as peças voltaram ao catálogo."} <Link to="/catalogo">Ver o catálogo</Link></p>
      )}

      {feito >= 0 && (
        <section aria-labelledby="andamento-t" className="mb-8">
          <h2 id="andamento-t" className="subtitulo">Andamento</h2>
          <ol className="etapas">
            {ETAPAS.map((e, i) => <li key={e} className={i <= feito ? "feita" : ""} aria-current={i === feito ? "step" : undefined}><span>{e}</span></li>)}
          </ol>
          <p className="m-0">Código de rastreio: <code>{p.rastreio}</code> <span className="ajuda">(simulado)</span></p>
          {p.pontos > 0 && <p className="mt-2 mb-0">Esta compra somou <strong>{p.pontos} pontos</strong> e poupou {litros(p.agua)} de água e {quilos(p.co2)} de carbono.</p>}
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        <section aria-labelledby="itens-t">
          <h2 id="itens-t" className="subtitulo">Peças</h2>
          <ul className="linhas">
            {p.itens.map((i, n) => (
              <li key={n}>
                <div className="linha-texto">{i.pecaId ? <Link to={`/catalogo/${i.pecaId}`}>{i.titulo}</Link> : <span className="forte">{i.titulo}</span>}<span>{i.categoria}</span></div>
                <strong className="linha-valor">{brl(i.preco)}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="historico-t">
          <h2 id="historico-t" className="subtitulo">Histórico</h2>
          <ol className="historico">
            {p.eventos.map((e, n) => <li key={n}><span>{e.etapa}</span><time dateTime={new Date(e.quando).toISOString()}>{dia(e.quando)}, {hora(e.quando)}</time></li>)}
          </ol>
        </section>
      </div>
    </article>
  );
}
