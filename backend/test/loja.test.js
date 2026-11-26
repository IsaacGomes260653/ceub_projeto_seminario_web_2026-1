import { beforeEach, describe, expect, it } from "vitest";
import { somarImpacto } from "../src/impacto.js";
import { montar } from "./apoio.js";

const MINUTO = 60 * 1000;
let ctx, relogio, ana, bia, admin;
beforeEach(async () => {
  relogio = { t: 1_800_000_000_000 };
  ctx = montar({ agora: () => relogio.t });
  ana = await ctx.entrar("ana@ciranda.app");
  bia = await ctx.entrar("beatriz@ciranda.app");
  admin = await ctx.entrar("lucia@ciranda.app");
});
const idPeca = (foto) => ctx.db.prepare("SELECT id FROM pecas WHERE foto = ?").get(foto).id;
const situacao = (id) => ctx.db.prepare("SELECT situacao FROM pecas WHERE id = ?").get(id).situacao;
const colocar = (token, pecaId) => ctx.api("post", "/api/sacola", token).send({ pecaId });
// Monta um pedido da Ana com a calça jeans (acervo) e a jaqueta (consignada pela Beatriz).
async function pedidoDaAna() {
  await colocar(ana, idPeca("calca-jeans.webp"));
  await colocar(ana, idPeca("jaqueta-jeans.webp"));
  return (await ctx.api("post", "/api/pedidos", ana)).body;
}

describe("sacola com reserva de 30 minutos", () => {
  it("reserva a peça para quem colocou e soma o total", async () => {
    const id = idPeca("calca-jeans.webp");
    const r = await colocar(ana, id);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ total: 119.9, itens: [{ id, reservadaAte: relogio.t + 30 * MINUTO }] });
    expect(situacao(id)).toBe("Reservada");
    // Colocar de novo não duplica nem dá erro.
    expect((await colocar(ana, id)).body.itens).toHaveLength(1);
  });
  it("não deixa duas pessoas reservarem a mesma peça", async () => {
    const id = idPeca("calca-jeans.webp");
    await colocar(ana, id);
    const r = await colocar(admin, id);
    expect(r.status).toBe(409);
    expect(r.body.erro).toMatch(/reservada por outra pessoa/);
  });
  it("recusa peça vendida, peça própria, peça fora do catálogo e peça inexistente", async () => {
    const vendida = idPeca("tenis-lona.webp");
    ctx.db.prepare("UPDATE pecas SET situacao = 'Vendida' WHERE id = ?").run(vendida);
    expect((await colocar(ana, vendida)).body.erro).toMatch(/já foi vendida/);
    expect((await colocar(bia, idPeca("jaqueta-jeans.webp"))).body.erro).toMatch(/Esta peça é sua/);
    const emAnalise = ctx.db.prepare("SELECT id FROM pecas WHERE situacao = 'Em análise'").get().id;
    expect((await colocar(ana, emAnalise)).status).toBe(404);
    expect((await colocar(ana, 9999)).status).toBe(404);
    expect((await colocar(ana, "abc")).status).toBe(400);
  });
  it("devolve a peça ao catálogo quando sai da sacola", async () => {
    const id = idPeca("calca-jeans.webp");
    await colocar(ana, id);
    expect((await ctx.api("delete", `/api/sacola/${id}`, admin)).status).toBe(404);
    const r = await ctx.api("delete", `/api/sacola/${id}`, ana);
    expect(r.body).toEqual({ itens: [], total: 0 });
    expect(situacao(id)).toBe("Disponível");
  });
  it("solta a reserva sozinha depois de 30 minutos", async () => {
    const id = idPeca("calca-jeans.webp");
    await colocar(ana, id);
    relogio.t += 29 * MINUTO;
    expect((await ctx.api("get", "/api/sacola", ana)).body.itens).toHaveLength(1);
    relogio.t += 2 * MINUTO;
    expect((await ctx.api("get", "/api/sacola", ana)).body.itens).toHaveLength(0);
    expect(situacao(id)).toBe("Disponível");
    expect((await colocar(admin, id)).status).toBe(201);
  });
});

describe("pedido com Pix simulado", () => {
  it("fecha a sacola em um pedido aguardando pagamento", async () => {
    const p = await pedidoDaAna();
    expect(p).toMatchObject({ situacao: "Aguardando pagamento", total: 249.8, cliente: "Ana Costa", rastreio: "", expiraEm: relogio.t + 30 * MINUTO });
    expect(p.pix).toMatch(/^PIX-SIMULADO-[0-9A-F]{16}$/);
    expect(p.itens.map((i) => i.titulo)).toEqual(["Calça jeans reta lavagem média", "Jaqueta jeans oversized"]);
    expect(p.eventos.map((e) => e.etapa)).toEqual(["Pedido criado"]);
    expect((await ctx.api("get", "/api/sacola", ana)).body.itens).toHaveLength(0);
    expect(situacao(idPeca("calca-jeans.webp"))).toBe("Reservada");
  });
  it("não fecha pedido com a sacola vazia", async () => {
    const r = await ctx.api("post", "/api/pedidos", ana);
    expect(r.status).toBe(409);
    expect(r.body.erro).toBe("Sua sacola está vazia.");
  });
  it("ao pagar, vende as peças, soma uma volta, gera rastreio e credita pontos", async () => {
    const p = await pedidoDaAna();
    const voltasAntes = ctx.db.prepare("SELECT voltas FROM pecas WHERE foto = 'calca-jeans.webp'").get().voltas;
    const pago = (await ctx.api("post", `/api/pedidos/${p.id}/pagar`, ana)).body;
    expect(pago).toMatchObject({ situacao: "Pago", pontos: 323, agua: 5231, co2: 32.3 });
    expect(pago.rastreio).toMatch(/^CR\d{9}BR$/);
    expect(pago.eventos.map((e) => e.etapa)).toEqual(["Pedido criado", "Pagamento confirmado"]);
    expect(situacao(idPeca("calca-jeans.webp"))).toBe("Vendida");
    expect(ctx.db.prepare("SELECT voltas FROM pecas WHERE foto = 'calca-jeans.webp'").get().voltas).toBe(voltasAntes + 1);
    expect((await ctx.api("post", `/api/pedidos/${p.id}/pagar`, ana)).status).toBe(409);
    expect((await ctx.api("get", "/api/impacto", ana)).body).toEqual({ pedidos: 1, pecas: 2, pontos: 323, agua: 5231, co2: 32.3 });
  });
  it("paga mesmo se a peça foi removida do acervo no meio do caminho", async () => {
    const p = await pedidoDaAna();
    ctx.db.prepare("DELETE FROM pecas WHERE foto = 'calca-jeans.webp'").run();
    expect((await ctx.api("post", `/api/pedidos/${p.id}/pagar`, ana)).body.situacao).toBe("Pago");
  });
  it("cancela antes de pagar e devolve as peças", async () => {
    const p = await pedidoDaAna();
    const r = await ctx.api("post", `/api/pedidos/${p.id}/cancelar`, ana);
    expect(r.body.situacao).toBe("Cancelado");
    expect(situacao(idPeca("calca-jeans.webp"))).toBe("Disponível");
    expect((await ctx.api("post", `/api/pedidos/${p.id}/cancelar`, ana)).status).toBe(409);
    expect((await ctx.api("post", `/api/pedidos/${p.id}/pagar`, ana)).body.erro).toMatch(/não está aguardando/);
  });
  it("expira o pedido que não foi pago em 30 minutos", async () => {
    const p = await pedidoDaAna();
    relogio.t += 31 * MINUTO;
    const visto = (await ctx.api("get", `/api/pedidos/${p.id}`, ana)).body;
    expect(visto.situacao).toBe("Expirado");
    expect(visto.eventos.at(-1).etapa).toBe("Reserva vencida sem pagamento");
    expect(situacao(idPeca("jaqueta-jeans.webp"))).toBe("Disponível");
    expect((await ctx.api("post", `/api/pedidos/${p.id}/pagar`, ana)).body.erro).toMatch(/A reserva venceu/);
  });
  it("cada pessoa só vê os próprios pedidos", async () => {
    const p = await pedidoDaAna();
    expect((await ctx.api("get", "/api/pedidos", ana)).body).toHaveLength(1);
    expect((await ctx.api("get", "/api/pedidos", bia)).body).toHaveLength(0);
    expect((await ctx.api("get", `/api/pedidos/${p.id}`, bia)).status).toBe(404);
    expect((await ctx.api("get", "/api/pedidos?todos=1", bia)).status).toBe(403);
    expect((await ctx.api("get", "/api/pedidos?todos=1", admin)).body).toHaveLength(1);
    expect((await ctx.api("get", `/api/pedidos/${p.id}`, admin)).body.cliente).toBe("Ana Costa");
    // Quem vê tudo ainda não pode pagar nem cancelar o pedido de outra pessoa.
    expect((await ctx.api("post", `/api/pedidos/${p.id}/pagar`, admin)).status).toBe(403);
    expect((await ctx.api("get", "/api/pedidos/9999", ana)).status).toBe(404);
  });
  it("perfil sem a funcionalidade de compra não lista pedidos", async () => {
    ctx.db.prepare("DELETE FROM perfil_funcionalidades WHERE funcionalidade_id = (SELECT id FROM funcionalidades WHERE chave = 'sacola.usar') AND perfil_id = (SELECT id FROM perfis WHERE nome = 'Cliente')").run();
    expect((await ctx.api("get", "/api/pedidos", ana)).status).toBe(403);
    expect((await ctx.api("get", "/api/sacola", ana)).status).toBe(403);
  });
});

describe("linha do tempo do pedido", () => {
  it("avança uma etapa por vez até a entrega", async () => {
    const p = await pedidoDaAna();
    const avancar = () => ctx.api("post", `/api/pedidos/${p.id}/avancar`, admin);
    expect((await avancar()).body.erro).toBe("Só um pedido pago pode avançar.");
    await ctx.api("post", `/api/pedidos/${p.id}/pagar`, ana);
    expect((await ctx.api("post", `/api/pedidos/${p.id}/avancar`, ana)).status).toBe(403);
    expect((await avancar()).body.situacao).toBe("Em separação");
    expect((await avancar()).body.situacao).toBe("Enviado");
    const fim = (await avancar()).body;
    expect(fim.situacao).toBe("Entregue");
    expect(fim.eventos.map((e) => e.etapa)).toEqual(["Pedido criado", "Pagamento confirmado", "Peças separadas e embaladas", "Pacote postado", "Pedido entregue"]);
    expect((await avancar()).body.erro).toBe("Este pedido já foi entregue.");
  });
});

describe("consignação", () => {
  const nova = { titulo: "Bolsa de couro caramelo", categoria: "Bolsas e acessórios", conservacao: "Bom estado", preco: 180 };

  it("a peça enviada espera análise e fica fora do catálogo", async () => {
    const r = await ctx.api("post", "/api/consignacoes", ana).send(nova);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ situacao: "Em análise", dono: "Ana Costa", repasse: null, parteDoDono: 0.6 });
    expect((await ctx.api("get", "/api/pecas", ana)).body.some((p) => p.id === r.body.id)).toBe(false);
    expect((await ctx.api("get", `/api/pecas/${r.body.id}`, ana)).status).toBe(404);
    expect((await ctx.api("get", `/api/pecas/${r.body.id}`, admin)).status).toBe(200);
    expect((await ctx.api("get", "/api/consignacoes", ana)).body).toHaveLength(1);
    expect((await ctx.api("post", "/api/consignacoes", ana).send({ ...nova, preco: 0 })).status).toBe(400);
  });
  it("só quem aprova vê a fila, e aprovar coloca a peça no catálogo", async () => {
    const { id } = (await ctx.api("post", "/api/consignacoes", ana).send(nova)).body;
    expect((await ctx.api("get", "/api/consignacoes?fila=1", ana)).status).toBe(403);
    expect((await ctx.api("get", "/api/consignacoes?fila=1", admin)).body.map((p) => p.titulo)).toEqual(["Saia midi plissada", "Bolsa de couro caramelo"]);
    expect((await ctx.api("post", `/api/consignacoes/${id}/aprovar`, ana)).status).toBe(403);
    expect((await ctx.api("post", `/api/consignacoes/${id}/aprovar`, admin)).body.situacao).toBe("Disponível");
    expect((await ctx.api("post", `/api/consignacoes/${id}/aprovar`, admin)).status).toBe(409);
    expect((await ctx.api("get", `/api/pecas/${id}`, ana)).status).toBe(200);
    expect((await ctx.api("delete", `/api/consignacoes/${id}`, ana)).body.erro).toMatch(/já está no catálogo/);
  });
  it("recusar exige um motivo, que a pessoa lê depois", async () => {
    const { id } = (await ctx.api("post", "/api/consignacoes", ana).send(nova)).body;
    expect((await ctx.api("post", `/api/consignacoes/${id}/recusar`, admin).send({})).status).toBe(400);
    await ctx.api("post", `/api/consignacoes/${id}/recusar`, admin).send({ motivo: "Zíper quebrado." });
    expect((await ctx.api("get", "/api/consignacoes", ana)).body[0]).toMatchObject({ situacao: "Recusada", motivo: "Zíper quebrado." });
    expect((await ctx.api("delete", `/api/consignacoes/${id}`, admin)).status).toBe(403);
    expect((await ctx.api("delete", `/api/consignacoes/${id}`, bia)).status).toBe(404);
    expect((await ctx.api("delete", `/api/consignacoes/${id}`, ana)).status).toBe(204);
  });
  it("perfil sem a funcionalidade não lista consignações", async () => {
    ctx.db.prepare("DELETE FROM perfil_funcionalidades WHERE funcionalidade_id = (SELECT id FROM funcionalidades WHERE chave = 'consignacao.publicar') AND perfil_id = (SELECT id FROM perfis WHERE nome = 'Cliente')").run();
    expect((await ctx.api("get", "/api/consignacoes", ana)).status).toBe(403);
  });
  it("a venda gera repasse de 60% para quem deixou a peça", async () => {
    const p = await pedidoDaAna();
    const jaqueta = () => ctx.api("get", "/api/consignacoes", bia).then((r) => r.body.find((c) => c.titulo === "Jaqueta jeans oversized"));
    expect((await jaqueta()).repasse).toBeNull();
    await ctx.api("post", `/api/pedidos/${p.id}/pagar`, ana);
    expect((await jaqueta())).toMatchObject({ situacao: "Vendida", repasse: 77.94 });
  });
});

describe("bastidores e pontos", () => {
  it("resume peças, pedidos, faturamento e repasses", async () => {
    const p = await pedidoDaAna();
    await ctx.api("post", `/api/pedidos/${p.id}/pagar`, ana);
    expect((await ctx.api("get", "/api/bastidores", ana)).status).toBe(403);
    const r = (await ctx.api("get", "/api/bastidores", admin)).body;
    expect(r).toMatchObject({
      pecas: { "Disponível": 11, "Vendida": 2, "Em análise": 1 }, pedidos: { Pago: 1 },
      faturamento: 249.8, repasseDevido: 77.94, ficaNoBrecho: 171.86, agua: 5231, co2: 32.3, pontos: 323,
      repasses: [{ dono: "Beatriz Ribeiro", pecas: 1, valor: 77.94 }],
    });
  });
  it("começa zerado para quem nunca comprou", async () => {
    expect((await ctx.api("get", "/api/impacto", ana)).body).toEqual({ pedidos: 0, pecas: 0, pontos: 0, agua: 0, co2: 0 });
    expect((await ctx.api("get", "/api/bastidores", admin)).body).toMatchObject({ faturamento: 0, repasses: [], pedidos: {} });
  });
  it("categoria sem fator não soma impacto", () => {
    expect(somarImpacto(["Calçados", "Camisas"])).toEqual({ agua: 870, co2: 4.2, pontos: 42 });
  });
});

describe("cadastro aberto", () => {
  const dados = { nome: "Camila Prado", email: "Camila@Ciranda.app", senha: "senha-forte-1" };

  it("cria a conta como Cliente e já devolve a sessão", async () => {
    const r = await ctx.api("post", "/api/auth/cadastro").send({ ...dados, perfilId: 1, perfil: "Administradora" });
    expect(r.status).toBe(201);
    expect(r.body.usuario).toMatchObject({ email: "camila@ciranda.app", perfil: "Cliente" });
    expect((await ctx.api("get", "/api/usuarios", r.body.token)).status).toBe(403);
    expect(await ctx.entrar("camila@ciranda.app", "senha-forte-1")).toEqual(expect.any(String));
  });
  it("valida os campos e recusa e-mail repetido", async () => {
    const curto = await ctx.api("post", "/api/auth/cadastro").send({ nome: "Ca", email: "x", senha: "123" });
    expect(Object.keys(curto.body.detalhes).sort()).toEqual(["email", "nome", "senha"]);
    const repetido = await ctx.api("post", "/api/auth/cadastro").send({ ...dados, email: "ana@ciranda.app" });
    expect(repetido.status).toBe(409);
  });
  it("fecha o cadastro se o perfil Cliente não existir", async () => {
    ctx.db.prepare("DELETE FROM usuarios WHERE perfil_id = (SELECT id FROM perfis WHERE nome = 'Cliente')").run();
    ctx.db.prepare("DELETE FROM perfis WHERE nome = 'Cliente'").run();
    expect((await ctx.api("post", "/api/auth/cadastro").send(dados)).status).toBe(503);
  });
});

describe("remoções em cascata", () => {
  it("remover a conta leva junto sacola e pedidos, e solta as peças do dono", async () => {
    await pedidoDaAna();
    const idAna = ctx.db.prepare("SELECT id FROM usuarios WHERE email = 'ana@ciranda.app'").get().id;
    expect((await ctx.api("delete", `/api/usuarios/${idAna}`, admin)).status).toBe(204);
    expect(ctx.db.prepare("SELECT COUNT(*) AS n FROM pedidos").get().n).toBe(0);
  });
});
