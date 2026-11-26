import { useEffect, useState } from "react";
import { api } from "../api.js";
import { PaginaCrud } from "../componentes/PaginaCrud.jsx";
import { brl, CATEGORIAS, CONSERVACOES, FOTOS, SITUACOES } from "../menu.js";

const opcoes = (lista) => lista.map((v) => ({ valor: v, rotulo: v }));

// Busca uma lista de apoio (perfis ou funcionalidades) para montar as opções do formulário.
function useLista(recurso) {
  const [lista, setLista] = useState([]);
  useEffect(() => { api.listar(recurso).then(setLista).catch(() => setLista([])); }, [recurso]);
  return lista;
}

// CRUD 01
export function Usuarios() {
  const perfis = useLista("/perfis");
  return (
    <PaginaCrud titulo="Usuários" singular="Usuário" recurso="/usuarios"
      descricao="Quem pode entrar no sistema e com qual perfil."
      colunas={[
        { rotulo: "Nome", valor: (u) => u.nome },
        { rotulo: "E-mail", valor: (u) => u.email },
        { rotulo: "Perfil", valor: (u) => u.perfil },
        { rotulo: "Situação", valor: (u) => (u.ativo ? "Ativo" : "Inativo") },
      ]}
      campos={[
        { nome: "nome", rotulo: "Nome completo", tipo: "texto", obrigatorio: true, max: 80, auto: "name" },
        { nome: "email", rotulo: "E-mail", tipo: "email", obrigatorio: true, max: 120, auto: "email" },
        { nome: "perfilId", rotulo: "Perfil", tipo: "escolha", obrigatorio: true, opcoes: perfis.map((p) => ({ valor: String(p.id), rotulo: p.nome })) },
        { nome: "senha", rotulo: "Senha", tipo: "senha", max: 200, auto: "new-password", obrigatorio: (editando) => !editando,
          ajuda: (editando) => (editando ? "Deixe em branco para manter a senha atual." : "Mínimo de 8 caracteres.") },
        { nome: "ativo", rotulo: "Conta ativa", tipo: "marcar", ajuda: "Conta inativa não consegue entrar." },
      ]}
      vazio={() => ({ nome: "", email: "", perfilId: "", senha: "", ativo: true })}
      paraFormulario={(u) => ({ nome: u.nome, email: u.email, perfilId: String(u.perfilId), senha: "", ativo: u.ativo })}
      paraEnvio={(v) => ({ nome: v.nome, email: v.email, perfilId: v.perfilId ? Number(v.perfilId) : undefined, ativo: v.ativo, ...(v.senha ? { senha: v.senha } : {}) })}
    />
  );
}

// CRUD 02
export function Perfis() {
  const funcionalidades = useLista("/funcionalidades");
  const nomes = Object.fromEntries(funcionalidades.map((f) => [f.id, f.nome]));
  return (
    <PaginaCrud titulo="Perfis" singular="Perfil" recurso="/perfis"
      descricao="Cada perfil reúne as funcionalidades que seus usuários podem usar."
      colunas={[
        { rotulo: "Nome", valor: (p) => p.nome },
        { rotulo: "Funcionalidades", valor: (p) => p.funcionalidades.map((id) => nomes[id]).filter(Boolean).join(", ") || "Nenhuma" },
        { rotulo: "Usuários", valor: (p) => p.usuarios },
      ]}
      campos={[
        { nome: "nome", rotulo: "Nome do perfil", tipo: "texto", obrigatorio: true, max: 60 },
        { nome: "descricao", rotulo: "Descrição", tipo: "texto", max: 200 },
        { nome: "funcionalidades", rotulo: "Funcionalidades liberadas", tipo: "grupo", largo: true,
          opcoes: funcionalidades.map((f) => ({ valor: f.id, rotulo: f.nome, detalhe: f.chave })) },
      ]}
      vazio={() => ({ nome: "", descricao: "", funcionalidades: [] })}
      paraFormulario={(p) => ({ nome: p.nome, descricao: p.descricao, funcionalidades: p.funcionalidades })}
    />
  );
}

// CRUD 03
export function Funcionalidades() {
  return (
    <PaginaCrud titulo="Funcionalidades" singular="Funcionalidade" recurso="/funcionalidades" feminino
      descricao="O que o sistema sabe fazer. Os perfis escolhem quais delas liberar."
      colunas={[
        { rotulo: "Nome", valor: (f) => f.nome },
        { rotulo: "Chave", valor: (f) => <code>{f.chave}</code> },
        { rotulo: "Descrição", valor: (f) => f.descricao || "Sem descrição" },
        { rotulo: "Perfis", valor: (f) => f.perfis },
      ]}
      campos={[
        { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, max: 80 },
        { nome: "chave", rotulo: "Chave", tipo: "texto", obrigatorio: true, max: 60, ajuda: "Formato area.acao, em minúsculas. Exemplo: relatorios.ver" },
        { nome: "descricao", rotulo: "Descrição", tipo: "texto", max: 200, largo: true },
      ]}
      vazio={() => ({ nome: "", chave: "", descricao: "" })}
      paraFormulario={(f) => ({ nome: f.nome, chave: f.chave, descricao: f.descricao })}
    />
  );
}

// Funcionalidade do brechó: cadastro de peças
export function Pecas() {
  return (
    <PaginaCrud titulo="Peças" singular="Peça" recurso="/pecas" feminino nomeDe={(p) => p.titulo}
      descricao="As peças que aparecem no catálogo."
      colunas={[
        { rotulo: "Peça", valor: (p) => p.titulo },
        { rotulo: "Categoria", valor: (p) => p.categoria },
        { rotulo: "Preço", valor: (p) => brl(p.preco) },
        { rotulo: "Situação", valor: (p) => p.situacao },
      ]}
      campos={[
        { nome: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, max: 80, largo: true },
        { nome: "marca", rotulo: "Marca", tipo: "texto", max: 40 },
        { nome: "tamanho", rotulo: "Tamanho", tipo: "texto", max: 10 },
        { nome: "categoria", rotulo: "Categoria", tipo: "escolha", obrigatorio: true, opcoes: opcoes(CATEGORIAS) },
        { nome: "conservacao", rotulo: "Conservação", tipo: "escolha", obrigatorio: true, opcoes: opcoes(CONSERVACOES) },
        { nome: "preco", rotulo: "Preço em reais", tipo: "numero", obrigatorio: true, passo: "0.01", min: "0.01" },
        { nome: "voltas", rotulo: "Voltas", tipo: "numero", passo: "1", min: "1", ajuda: "Quantas vezes a peça já circulou, contando esta." },
        { nome: "situacao", rotulo: "Situação", tipo: "escolha", opcoes: opcoes(SITUACOES) },
        { nome: "foto", rotulo: "Foto", tipo: "escolha", opcoes: FOTOS.map((f) => ({ valor: `${f}.webp`, rotulo: f.replace(/-/g, " ") })) },
      ]}
      vazio={() => ({ titulo: "", marca: "", tamanho: "", categoria: "", conservacao: "", preco: "", voltas: "1", situacao: "Disponível", foto: "" })}
      paraFormulario={(p) => ({ titulo: p.titulo, marca: p.marca, tamanho: p.tamanho, categoria: p.categoria, conservacao: p.conservacao, preco: String(p.preco), voltas: String(p.voltas), situacao: p.situacao, foto: p.foto })}
      paraEnvio={(v) => ({ ...v, preco: v.preco === "" ? undefined : Number(v.preco), voltas: v.voltas === "" ? undefined : Number(v.voltas) })}
    />
  );
}
