import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Campo } from "./Campo.jsx";

// Tela de cadastro genérica: lista, cria, edita e remove qualquer recurso da API.
// Cada página só descreve colunas e campos. A lógica de CRUD fica em um lugar só.
export function PaginaCrud({ titulo, descricao, singular, recurso, colunas, campos, vazio, paraFormulario = (i) => i, paraEnvio = (v) => v, nomeDe = (i) => i.nome, feminino = false }) {
  const novo = `${feminino ? "Nova" : "Novo"} ${singular.toLowerCase()}`;
  const fim = feminino ? "a" : "o";
  const [itens, setItens] = useState(null);
  const [erroLista, setErroLista] = useState("");
  const [form, setForm] = useState(null);          // { id?, valores }
  const [erros, setErros] = useState({});
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(null); // id aguardando confirmação
  const [aviso, setAviso] = useState("");
  const tituloForm = useRef(null);
  const prefixo = recurso.slice(1);

  const carregar = useCallback(() => {
    setErroLista("");
    return api.listar(recurso).then(setItens).catch((e) => { setItens([]); setErroLista(e.message); });
  }, [recurso]);
  useEffect(() => { carregar(); }, [carregar]);
  // Ao abrir o formulário, o foco vai para o título dele: quem usa leitor de tela sabe onde está.
  useEffect(() => { if (form) tituloForm.current?.focus(); }, [form?.id, Boolean(form)]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = (item) => { setErros({}); setErroForm(""); setAviso(""); setRemovendo(null); setForm(item ? { id: item.id, valores: paraFormulario(item) } : { valores: vazio() }); };
  const fechar = () => setForm(null);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true); setErros({}); setErroForm("");
    try {
      const dados = paraEnvio(form.valores, Boolean(form.id));
      if (form.id) await api.atualizar(recurso, form.id, dados); else await api.criar(recurso, dados);
      setAviso(`${singular} ${form.id ? "atualizad" : "criad"}${fim} com sucesso.`);
      setForm(null);
      await carregar();
    } catch (erro) {
      setErros(erro.detalhes || {});
      setErroForm(erro.message);
      // O foco vai para o primeiro campo com erro, depois que a tela redesenhar.
      const primeiro = Object.keys(erro.detalhes || {})[0];
      if (primeiro) setTimeout(() => document.getElementById(`${prefixo}-${primeiro}`)?.focus(), 0);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(item) {
    try {
      await api.remover(recurso, item.id);
      setAviso(`${singular} removid${fim}.`);
      await carregar();
    } catch (erro) {
      setAviso(erro.message);
    } finally {
      setRemovendo(null);
    }
  }

  return (
    <section aria-labelledby={`${prefixo}-cabecalho`}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 id={`${prefixo}-cabecalho`} className="titulo">{titulo}</h1>
          {descricao && <p className="m-0 text-ceub-cinza max-w-2xl">{descricao}</p>}
        </div>
        {!form && <button type="button" className="btn filled" onClick={() => abrir(null)}>{novo}</button>}
      </div>

      <p className="aviso" role="status" aria-live="polite">{aviso}</p>

      {form && (
        <form className="painel abre mb-8" onSubmit={salvar} noValidate aria-labelledby={`${prefixo}-form-titulo`}>
          <h2 id={`${prefixo}-form-titulo`} ref={tituloForm} tabIndex="-1" className="subtitulo">{form.id ? `Editar ${singular.toLowerCase()}` : novo}</h2>
          {erroForm && <p className="erro-geral" role="alert">{erroForm}</p>}
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
            {campos.filter((c) => !c.somenteNaCriacao || !form.id).map((c) => (
              <div key={c.nome} className={c.largo ? "md:col-span-2" : ""}>
                <Campo campo={{ ...c, obrigatorio: typeof c.obrigatorio === "function" ? c.obrigatorio(Boolean(form.id)) : c.obrigatorio, ajuda: typeof c.ajuda === "function" ? c.ajuda(Boolean(form.id)) : c.ajuda }}
                  prefixo={prefixo} valor={form.valores[c.nome]} erro={erros[c.nome]}
                  aoMudar={(v) => setForm((f) => ({ ...f, valores: { ...f.valores, [c.nome]: v } }))} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-6">
            <button type="submit" className="btn filled" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
            <button type="button" className="btn outlined" onClick={fechar}>Cancelar</button>
          </div>
        </form>
      )}

      {erroLista && <p className="erro-geral" role="alert">{erroLista} <button type="button" className="btn-flat" onClick={carregar}>Tentar de novo</button></p>}
      {itens === null ? <p role="status">Carregando…</p> : itens.length === 0 && !erroLista ? (
        <p className="painel">Nada cadastrado ainda. Use o botão "{novo}" para começar.</p>
      ) : itens.length > 0 && (
        <div className="tabela-rolavel" role="region" aria-label={`Lista de ${titulo.toLowerCase()}`} tabIndex="0">
          <table className="striped">
            <caption className="sr-only">{titulo}</caption>
            <thead><tr>{colunas.map((c) => <th key={c.rotulo} scope="col">{c.rotulo}</th>)}<th scope="col">Ações</th></tr></thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id}>
                  {colunas.map((c, i) => i === 0
                    ? <th key={c.rotulo} scope="row">{c.valor(item)}</th>
                    : <td key={c.rotulo} data-rotulo={c.rotulo}>{c.valor(item)}</td>)}
                  <td className="acoes">
                    {removendo === item.id ? (
                      <span role="group" aria-label={`Confirmar remoção de ${nomeDe(item)}`}>
                        <span className="mr-2">Remover?</span>
                        <button type="button" className="btn btn-small perigo" onClick={() => remover(item)}>Sim, remover</button>{" "}
                        <button type="button" className="btn btn-small outlined" onClick={() => setRemovendo(null)}>Não</button>
                      </span>
                    ) : (
                      <>
                        <button type="button" className="btn btn-small tonal" aria-label={`Editar ${nomeDe(item)}`} onClick={() => abrir(item)}>Editar</button>{" "}
                        <button type="button" className="btn btn-small outlined" aria-label={`Remover ${nomeDe(item)}`} onClick={() => { setAviso(""); setRemovendo(item.id); }}>Remover</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
