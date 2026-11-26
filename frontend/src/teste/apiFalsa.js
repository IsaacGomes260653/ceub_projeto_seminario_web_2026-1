import { vi } from "vitest";

// API falsa (fake): um servidor em memória com as mesmas rotas e regras básicas da API real.
// Os testes de tela rodam contra ela, sem rede e sem backend, e cada teste recebe dados novos.
const F = [
  { id: 1, chave: "catalogo.ver", nome: "Ver o catálogo", descricao: "", perfis: 3 },
  { id: 2, chave: "pecas.gerenciar", nome: "Gerenciar peças", descricao: "", perfis: 2 },
  { id: 3, chave: "usuarios.gerenciar", nome: "Gerenciar usuários", descricao: "", perfis: 1 },
  { id: 4, chave: "perfis.gerenciar", nome: "Gerenciar perfis", descricao: "", perfis: 1 },
  { id: 5, chave: "funcionalidades.gerenciar", nome: "Gerenciar funcionalidades", descricao: "", perfis: 1 },
];
const chaves = (ids) => F.filter((f) => ids.includes(f.id)).map((f) => f.chave);

export function criarApiFalsa() {
  const banco = {
    funcionalidades: structuredClone(F),
    perfis: [
      { id: 1, nome: "Administradora", descricao: "Acesso completo.", usuarios: 1, funcionalidades: [1, 2, 3, 4, 5] },
      { id: 2, nome: "Cliente", descricao: "", usuarios: 1, funcionalidades: [1] },
      { id: 3, nome: "Fornecedor", descricao: "", usuarios: 1, funcionalidades: [1, 2] },
    ],
    usuarios: [
      { id: 1, nome: "Ana Costa", email: "ana@ciranda.app", perfilId: 2, perfil: "Cliente", ativo: true },
      { id: 2, nome: "Beatriz Ribeiro", email: "beatriz@ciranda.app", perfilId: 3, perfil: "Fornecedor", ativo: true },
      { id: 3, nome: "Lúcia Andrade", email: "lucia@ciranda.app", perfilId: 1, perfil: "Administradora", ativo: true },
    ],
    pecas: [
      { id: 1, titulo: "Calça jeans reta", marca: "Levi's", tamanho: "40", categoria: "Calças jeans", conservacao: "Bom estado", preco: 119.9, voltas: 3, foto: "calca-jeans.webp", situacao: "Disponível" },
      { id: 2, titulo: "Vestido midi floral", marca: "Farm", tamanho: "P", categoria: "Vestidos", conservacao: "Ótimo estado", preco: 149, voltas: 1, foto: "", situacao: "Reservada" },
    ],
  };
  const pedidos = [];
  let proximo = 100;
  const sessaoDe = (u) => ({ id: u.id, nome: u.nome, email: u.email, perfilId: u.perfilId, perfil: u.perfil, funcionalidades: chaves(banco.perfis.find((p) => p.id === u.perfilId).funcionalidades) });
  const resposta = (status, corpo) => ({ ok: status < 400, status, json: async () => { if (corpo === undefined) throw new Error("sem corpo"); return corpo; } });

  const buscar = vi.fn(async (url, opcoes = {}) => {
    const metodo = opcoes.method || "GET";
    const corpo = opcoes.body ? JSON.parse(opcoes.body) : undefined;
    const [caminho, consulta = ""] = url.replace(/^\/api/, "").split("?");
    const filtros = Object.fromEntries(new URLSearchParams(consulta));
    pedidos.push({ metodo, caminho, filtros, corpo, cabecalhos: opcoes.headers });
    const token = (opcoes.headers.Authorization || "").replace("Bearer ", "");

    if (caminho === "/auth/login") {
      const u = banco.usuarios.find((x) => x.email === corpo.email);
      if (!u || corpo.senha !== "ciranda123") return resposta(401, { erro: "E-mail ou senha incorretos." });
      return resposta(200, { token: `token-${u.id}`, usuario: sessaoDe(u) });
    }
    const logado = banco.usuarios.find((x) => `token-${x.id}` === token);
    if (!logado) return resposta(401, { erro: "Token de acesso inválido." });
    if (caminho === "/auth/eu") return resposta(200, { usuario: sessaoDe(logado) });

    const [, recurso, id] = caminho.split("/");
    const lista = banco[recurso];
    if (!lista) return resposta(404, { erro: "Rota não encontrada." });
    const item = id ? lista.find((x) => x.id === Number(id)) : null;
    if (id && !item) return resposta(404, { erro: "Não encontrado." });

    if (metodo === "GET") {
      let saida = lista;
      if (recurso === "pecas") {
        if (filtros.q) saida = saida.filter((p) => p.titulo.toLowerCase().includes(filtros.q.toLowerCase()));
        if (filtros.categoria) saida = saida.filter((p) => p.categoria === filtros.categoria);
      }
      return resposta(200, item || saida);
    }
    if (metodo === "DELETE") {
      if (recurso === "perfis" && item.usuarios > 0) return resposta(409, { erro: "Há usuários com este perfil. Troque o perfil deles antes de remover." });
      lista.splice(lista.indexOf(item), 1);
      return resposta(204);
    }
    // POST e PUT: validação mínima, igual em espírito à do servidor.
    const obrigatorio = { usuarios: ["nome", "email", "perfilId"], perfis: ["nome"], funcionalidades: ["nome", "chave"], pecas: ["titulo", "categoria", "conservacao", "preco"] }[recurso];
    const detalhes = Object.fromEntries(obrigatorio.filter((c) => corpo[c] === undefined || corpo[c] === "").map((c) => [c, "Campo obrigatório."]));
    if (recurso === "usuarios" && metodo === "POST" && !corpo.senha) detalhes.senha = "Campo obrigatório.";
    if (Object.keys(detalhes).length) return resposta(400, { erro: "Dados inválidos.", detalhes });
    if (recurso === "usuarios" && lista.some((u) => u.email === corpo.email && u !== item)) return resposta(409, { erro: "Já existe um usuário com esse e-mail." });
    const { senha, ...semSenha } = corpo;
    const extra = recurso === "usuarios" ? { perfil: banco.perfis.find((p) => p.id === corpo.perfilId)?.nome } : {};
    if (metodo === "PUT") { Object.assign(item, semSenha, extra); return resposta(200, item); }
    const novo = { id: proximo++, usuarios: 0, perfis: 0, ...semSenha, ...extra };
    lista.push(novo);
    return resposta(201, novo);
  });

  return { buscar, banco, pedidos, ultimo: (metodo) => pedidos.filter((p) => p.metodo === metodo).at(-1) };
}
