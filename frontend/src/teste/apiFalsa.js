import { vi } from "vitest";

// API falsa (fake): um servidor em memória com as mesmas rotas e regras básicas da API real.
// Os testes de tela rodam contra ela, sem rede e sem backend, e cada teste recebe dados novos.
const F = [
  { id: 1, chave: "catalogo.ver", nome: "Ver o catálogo", descricao: "", perfis: 3 },
  { id: 2, chave: "pecas.gerenciar", nome: "Gerenciar peças", descricao: "", perfis: 2 },
  { id: 3, chave: "usuarios.gerenciar", nome: "Gerenciar usuários", descricao: "", perfis: 1 },
  { id: 4, chave: "perfis.gerenciar", nome: "Gerenciar perfis", descricao: "", perfis: 1 },
  { id: 5, chave: "funcionalidades.gerenciar", nome: "Gerenciar funcionalidades", descricao: "", perfis: 1 },
  { id: 6, chave: "sacola.usar", nome: "Comprar", descricao: "", perfis: 3 },
  { id: 7, chave: "consignacao.publicar", nome: "Vender em consignação", descricao: "", perfis: 3 },
  { id: 8, chave: "consignacao.aprovar", nome: "Aprovar consignação", descricao: "", perfis: 1 },
  { id: 9, chave: "bastidores.ver", nome: "Ver os bastidores", descricao: "", perfis: 1 },
];
const IMPACTO = { "Calças jeans": [2911, 21, 210], "Vestidos": [1160, 5.6, 56], "Camisas": [870, 4.2, 42] };
const PAGOS = ["Pago", "Em separação", "Enviado", "Entregue"];
const chaves = (ids) => F.filter((f) => ids.includes(f.id)).map((f) => f.chave);

export function criarApiFalsa() {
  const banco = {
    funcionalidades: structuredClone(F),
    perfis: [
      { id: 1, nome: "Administradora", descricao: "Acesso completo.", usuarios: 1, funcionalidades: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
      { id: 2, nome: "Cliente", descricao: "", usuarios: 1, funcionalidades: [1, 6, 7] },
      { id: 3, nome: "Fornecedor", descricao: "", usuarios: 1, funcionalidades: [1, 2, 6, 7] },
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
    // Loja: itens de sacola, pedidos de compra e o relógio que os testes podem adiantar.
    sacola: [],
    compras: [],
    agora: 1_800_000_000_000,
  };
  const pedidos = [];
  let proximo = 100;
  const sessaoDe = (u) => ({ id: u.id, nome: u.nome, email: u.email, perfilId: u.perfilId, perfil: u.perfil, funcionalidades: chaves(banco.perfis.find((p) => p.id === u.perfilId).funcionalidades) });
  const resposta = (status, corpo) => ({ ok: status < 400, status, json: async () => { if (corpo === undefined) throw new Error("sem corpo"); return corpo; } });

  // Rotas da loja, com as mesmas regras do servidor em versão curta.
  function loja(metodo, caminho, filtros, corpo, logado, pode) {
    const [, recurso, id, acao] = caminho.split("/");
    const negado = resposta(403, { erro: "Seu perfil não tem acesso a esta funcionalidade." });
    const verSacola = () => {
      const itens = banco.sacola.filter((s) => s.usuarioId === logado.id).map((s) => ({ ...banco.pecas.find((p) => p.id === s.pecaId), reservadaAte: s.reservadaAte }));
      return { itens, total: Math.round(itens.reduce((t, i) => t + i.preco, 0) * 100) / 100 };
    };
    const consignada = (p) => {
      const venda = banco.compras.find((c) => PAGOS.includes(c.situacao) && c.itens.some((i) => i.pecaId === p.id));
      return { ...p, dono: banco.usuarios.find((u) => u.id === p.donoId)?.nome, motivo: p.motivo || "", repasse: venda ? Math.round(p.preco * 60) / 100 : null };
    };

    if (recurso === "sacola") {
      if (!pode.includes("sacola.usar")) return negado;
      if (metodo === "GET") return resposta(200, verSacola());
      const peca = banco.pecas.find((p) => p.id === Number(metodo === "POST" ? corpo.pecaId : id));
      if (metodo === "POST") {
        if (!peca) return resposta(404, { erro: "Peça não encontrada." });
        if (peca.situacao !== "Disponível") return resposta(409, { erro: "Esta peça acabou de ser reservada por outra pessoa." });
        peca.situacao = "Reservada";
        banco.sacola.push({ pecaId: peca.id, usuarioId: logado.id, reservadaAte: banco.agora + 30 * 60 * 1000 });
        return resposta(201, verSacola());
      }
      const i = banco.sacola.findIndex((s) => s.pecaId === Number(id) && s.usuarioId === logado.id);
      if (i < 0) return resposta(404, { erro: "Item da sacola não encontrado." });
      banco.sacola.splice(i, 1);
      peca.situacao = "Disponível";
      return resposta(200, verSacola());
    }

    if (recurso === "pedidos") {
      const veTudo = pode.includes("bastidores.ver");
      if (metodo === "GET" && !id) {
        if (filtros.todos && !veTudo) return negado;
        return resposta(200, banco.compras.filter((c) => filtros.todos || c.usuarioId === logado.id).slice().reverse());
      }
      if (metodo === "POST" && !id) {
        const { itens, total } = verSacola();
        if (!itens.length) return resposta(409, { erro: "Sua sacola está vazia." });
        const novo = {
          id: banco.compras.length + 1, usuarioId: logado.id, cliente: logado.nome, total, situacao: "Aguardando pagamento", pix: "PIX-SIMULADO-0123456789ABCDEF",
          rastreio: "", pontos: 0, agua: 0, co2: 0, expiraEm: banco.agora + 30 * 60 * 1000, criadoEm: banco.agora,
          itens: itens.map((i) => ({ pecaId: i.id, titulo: i.titulo, categoria: i.categoria, preco: i.preco, foto: i.foto })), eventos: [{ etapa: "Pedido criado", quando: banco.agora }],
        };
        banco.compras.push(novo);
        banco.sacola = banco.sacola.filter((s) => s.usuarioId !== logado.id);
        return resposta(201, novo);
      }
      const c = banco.compras.find((x) => x.id === Number(id) && (x.usuarioId === logado.id || veTudo));
      if (!c) return resposta(404, { erro: "Pedido não encontrado." });
      if (metodo === "GET") return resposta(200, c);
      const marcar = (situacao, etapa) => { c.situacao = situacao; c.eventos.push({ etapa, quando: banco.agora }); return resposta(200, c); };
      const pecasDe = () => c.itens.map((i) => banco.pecas.find((p) => p.id === i.pecaId));
      if (acao === "pagar") {
        if (c.situacao !== "Aguardando pagamento") return resposta(409, { erro: "Este pedido não está aguardando pagamento." });
        for (const p of pecasDe()) { p.situacao = "Vendida"; p.voltas += 1; }
        const f = c.itens.map((i) => IMPACTO[i.categoria] || [0, 0, 0]);
        Object.assign(c, { rastreio: "CR123456789BR", agua: f.reduce((t, x) => t + x[0], 0), co2: f.reduce((t, x) => t + x[1], 0), pontos: f.reduce((t, x) => t + x[2], 0) });
        return marcar("Pago", "Pagamento confirmado");
      }
      if (acao === "cancelar") { for (const p of pecasDe()) p.situacao = "Disponível"; return marcar("Cancelado", "Pedido cancelado"); }
      if (acao === "avancar") {
        if (!veTudo) return negado;
        const i = PAGOS.indexOf(c.situacao);
        if (i < 0 || i === PAGOS.length - 1) return resposta(409, { erro: "Só um pedido pago pode avançar." });
        return marcar(PAGOS[i + 1], PAGOS[i + 1]);
      }
    }

    if (recurso === "consignacoes") {
      const aprova = pode.includes("consignacao.aprovar");
      if (metodo === "GET") {
        if (filtros.fila && !aprova) return negado;
        return resposta(200, banco.pecas.filter((p) => (filtros.fila ? p.donoId && p.situacao === "Em análise" : p.donoId === logado.id)).map(consignada));
      }
      if (metodo === "POST" && !id) {
        const faltam = ["titulo", "categoria", "conservacao", "preco"].filter((c) => corpo[c] === undefined || corpo[c] === "");
        if (faltam.length) return resposta(400, { erro: "Dados inválidos.", detalhes: Object.fromEntries(faltam.map((c) => [c, "Campo obrigatório."])) });
        const nova = { id: proximo++, marca: "", tamanho: "", voltas: 1, foto: "", ...corpo, situacao: "Em análise", donoId: logado.id };
        banco.pecas.push(nova);
        return resposta(201, consignada(nova));
      }
      const p = banco.pecas.find((x) => x.id === Number(id));
      if (!p) return resposta(404, { erro: "Peça em consignação não encontrada." });
      if (metodo === "DELETE") { banco.pecas.splice(banco.pecas.indexOf(p), 1); return resposta(204); }
      if (!aprova) return negado;
      if (acao === "aprovar") { p.situacao = "Disponível"; return resposta(200, consignada(p)); }
      if (acao === "recusar") {
        if (!corpo.motivo || corpo.motivo.length < 3) return resposta(400, { erro: "Dados inválidos.", detalhes: { motivo: "Mínimo de 3 caracteres." } });
        Object.assign(p, { situacao: "Recusada", motivo: corpo.motivo });
        return resposta(200, consignada(p));
      }
    }

    const pagos = (lista) => lista.filter((c) => PAGOS.includes(c.situacao));
    const somar = (lista, campo) => Math.round(lista.reduce((t, c) => t + c[campo], 0) * 100) / 100;
    if (recurso === "impacto") {
      const meus = pagos(banco.compras.filter((c) => c.usuarioId === logado.id));
      return resposta(200, { pedidos: meus.length, pecas: meus.reduce((t, c) => t + c.itens.length, 0), pontos: somar(meus, "pontos"), agua: somar(meus, "agua"), co2: somar(meus, "co2") });
    }
    if (recurso === "bastidores") {
      if (!pode.includes("bastidores.ver")) return negado;
      const vendas = pagos(banco.compras);
      const contar = (lista) => lista.reduce((t, x) => ({ ...t, [x.situacao]: (t[x.situacao] || 0) + 1 }), {});
      const porDono = {};
      for (const i of vendas.flatMap((c) => c.itens)) {
        const peca = banco.pecas.find((p) => p.id === i.pecaId);
        if (!peca?.donoId) continue;
        const dono = banco.usuarios.find((u) => u.id === peca.donoId).nome;
        porDono[dono] = { dono, pecas: (porDono[dono]?.pecas || 0) + 1, valor: Math.round(((porDono[dono]?.valor || 0) + i.preco * 0.6) * 100) / 100 };
      }
      const repasses = Object.values(porDono);
      const faturamento = somar(vendas, "total");
      const repasseDevido = somar(repasses, "valor");
      return resposta(200, { pecas: contar(banco.pecas), pedidos: contar(banco.compras), faturamento, repasseDevido, ficaNoBrecho: Math.round((faturamento - repasseDevido) * 100) / 100, repasses, agua: somar(vendas, "agua"), co2: somar(vendas, "co2"), pontos: somar(vendas, "pontos") });
    }
    return null;
  }

  const buscar = vi.fn(async (url, opcoes = {}) => {
    const metodo = opcoes.method || "GET";
    const corpo = opcoes.body ? JSON.parse(opcoes.body) : undefined;
    const [caminho, consulta = ""] = url.replace(/^\/api/, "").split("?");
    const filtros = Object.fromEntries(new URLSearchParams(consulta));
    pedidos.push({ metodo, caminho, filtros, corpo, cabecalhos: opcoes.headers });
    const token = (opcoes.headers.Authorization || "").replace("Bearer ", "");

    // Cookie de sessão de mentira: guarda o id de quem tem sessão aberta, como o cookie HttpOnly faria.
    if (caminho === "/auth/renovar") {
      const dono = banco.usuarios.find((x) => x.id === banco.cookie && x.ativo);
      if (!dono) return resposta(401, { erro: "Sessão encerrada. Entre de novo." });
      return resposta(200, { token: `token-${dono.id}`, usuario: sessaoDe(dono) });
    }
    if (caminho === "/auth/sair") { banco.cookie = null; return resposta(204); }
    if (caminho === "/auth/cadastro") {
      const detalhes = {};
      if (!corpo.nome) detalhes.nome = "Campo obrigatório.";
      if (!corpo.email) detalhes.email = "Campo obrigatório.";
      if (!corpo.senha || corpo.senha.length < 8) detalhes.senha = "Mínimo de 8 caracteres.";
      if (Object.keys(detalhes).length) return resposta(400, { erro: "Dados inválidos.", detalhes });
      if (banco.usuarios.some((x) => x.email === corpo.email)) return resposta(409, { erro: "Já existe uma conta com esse e-mail. Entre com ela." });
      const u = { id: proximo++, nome: corpo.nome, email: corpo.email, perfilId: 2, perfil: "Cliente", ativo: true };
      banco.usuarios.push(u);
      return resposta(201, { token: `token-${u.id}`, usuario: sessaoDe(u) });
    }
    if (caminho === "/auth/login") {
      const u = banco.usuarios.find((x) => x.email === corpo.email);
      if (!u || corpo.senha !== "ciranda123") return resposta(401, { erro: "E-mail ou senha incorretos." });
      banco.cookie = u.id;
      return resposta(200, { token: `token-${u.id}`, usuario: sessaoDe(u) });
    }
    const logado = banco.usuarios.find((x) => `token-${x.id}` === token);
    if (!logado) return resposta(401, { erro: "Token de acesso inválido." });
    if (caminho === "/auth/eu") return resposta(200, { usuario: sessaoDe(logado) });
    const daLoja = loja(metodo, caminho, filtros, corpo || {}, logado, sessaoDe(logado).funcionalidades);
    if (daLoja) return daLoja;

    const [, recurso, id] = caminho.split("/");
    const lista = banco[recurso];
    if (!lista) return resposta(404, { erro: "Rota não encontrada." });
    const item = id ? lista.find((x) => x.id === Number(id)) : null;
    if (id && !item) return resposta(404, { erro: "Não encontrado." });

    if (metodo === "GET") {
      let saida = lista;
      if (recurso === "pecas") {
        if (!sessaoDe(logado).funcionalidades.includes("pecas.gerenciar")) saida = saida.filter((p) => !["Em análise", "Recusada"].includes(p.situacao));
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
