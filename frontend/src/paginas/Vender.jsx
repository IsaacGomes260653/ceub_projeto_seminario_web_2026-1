import { useState } from "react";
import { api } from "../api.js";
import { Campo } from "../componentes/Campo.jsx";
import { Espera, usarDados } from "../componentes/usarDados.jsx";
import { brl, CATEGORIAS, CONSERVACOES, PARTE_DO_DONO } from "../menu.js";

const opcoes = (lista) => lista.map((v) => ({ valor: v, rotulo: v }));
const CAMPOS = [
  { nome: "titulo", rotulo: "O que é a peça", tipo: "texto", obrigatorio: true, max: 80, largo: true, ajuda: "Exemplo: jaqueta jeans oversized." },
  { nome: "marca", rotulo: "Marca", tipo: "texto", max: 40 },
  { nome: "tamanho", rotulo: "Tamanho", tipo: "texto", max: 10 },
  { nome: "categoria", rotulo: "Categoria", tipo: "escolha", obrigatorio: true, opcoes: opcoes(CATEGORIAS) },
  { nome: "conservacao", rotulo: "Conservação", tipo: "escolha", obrigatorio: true, opcoes: opcoes(CONSERVACOES) },
  { nome: "preco", rotulo: "Preço de venda em reais", tipo: "numero", obrigatorio: true, passo: "0.01", min: "0.01" },
];
const VAZIO = { titulo: "", marca: "", tamanho: "", categoria: "", conservacao: "", preco: "" };
const O_QUE_ACONTECE = {
  "Em análise": "O brechó ainda vai olhar esta peça.",
  "Disponível": "Aprovada e à venda no catálogo.",
  "Reservada": "Está na sacola de alguém.",
  "Recusada": "Não entrou no catálogo.",
};

// Consignação: a pessoa envia a peça, o brechó aprova, e 60% do preço volta para ela quando vender.
export function Vender() {
  const { dados, erro, carregar } = usarDados(() => api.listar("/consignacoes"));
  const [valores, setValores] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [falha, setFalha] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const preco = Number(valores.preco);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true); setErros({}); setFalha(""); setAviso("");
    try {
      await api.criar("/consignacoes", { ...valores, preco: valores.preco === "" ? undefined : preco });
      setValores(VAZIO);
      setAviso("Peça enviada para análise. Ela aparece na lista abaixo.");
      await carregar();
    } catch (erroApi) {
      setErros(erroApi.detalhes || {});
      setFalha(erroApi.message);
      const primeiro = Object.keys(erroApi.detalhes || {})[0];
      if (primeiro) setTimeout(() => document.getElementById(`vender-${primeiro}`)?.focus(), 0);
    } finally { setEnviando(false); }
  }
  const retirar = (p) => api.remover("/consignacoes", p.id).then(() => { setAviso(`${p.titulo} foi retirada.`); return carregar(); }).catch((e) => setAviso(e.message));

  return (
    <section aria-labelledby="vender-t">
      <h1 id="vender-t" className="titulo">Vender</h1>
      <p className="m-0 mb-6 text-ceub-cinza max-w-2xl">Deixe uma peça em consignação. O brechó analisa, coloca no catálogo e, quando ela vender, {Math.round(PARTE_DO_DONO * 100)}% do preço é seu.</p>
      <p className="aviso" role="status" aria-live="polite">{aviso}</p>

      <form className="painel mb-8" onSubmit={enviar} noValidate aria-labelledby="vender-form-t">
        <h2 id="vender-form-t" className="subtitulo">Enviar uma peça</h2>
        {falha && <p className="erro-geral" role="alert">{falha}</p>}
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
          {CAMPOS.map((c) => (
            <div key={c.nome} className={c.largo ? "md:col-span-2" : ""}>
              <Campo campo={c} prefixo="vender" valor={valores[c.nome]} erro={erros[c.nome]} aoMudar={(v) => setValores((a) => ({ ...a, [c.nome]: v }))} />
            </div>
          ))}
          <p className="repasse-previsto" role="status">{preco > 0 ? <>Se vender por {brl(preco)}, você recebe <strong>{brl(preco * PARTE_DO_DONO)}</strong>.</> : "Informe o preço para ver quanto você recebe."}</p>
        </div>
        <button type="submit" className="btn filled mt-6" disabled={enviando}>{enviando ? "Enviando…" : "Enviar para análise"}</button>
      </form>

      <h2 className="subtitulo">Suas peças</h2>
      {!dados ? <Espera erro={erro} aoTentar={carregar} /> : dados.length === 0 ? (
        <p className="painel">Você ainda não enviou nenhuma peça. Use o formulário acima para mandar a primeira.</p>
      ) : (
        <ul className="linhas">
          {dados.map((p) => (
            <li key={p.id}>
              <div className="linha-texto">
                <span className="forte">{p.titulo}</span>
                <span>{p.situacao === "Vendida" ? `Vendida. Seu repasse: ${brl(p.repasse ?? p.preco * PARTE_DO_DONO)}.` : O_QUE_ACONTECE[p.situacao]}</span>
                {p.situacao === "Recusada" && p.motivo && <span>Motivo: {p.motivo}</span>}
              </div>
              <strong className="linha-valor">{brl(p.preco)}</strong>
              <span className={`situacao ${["Disponível", "Vendida"].includes(p.situacao) ? "ok" : ""}`}>{p.situacao}</span>
              {["Em análise", "Recusada"].includes(p.situacao) && <button type="button" className="btn btn-small outlined" aria-label={`Retirar ${p.titulo}`} onClick={() => retirar(p)}>Retirar</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
