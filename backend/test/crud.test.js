import { beforeEach, describe, expect, it } from "vitest";
import { montar } from "./apoio.js";

let ctx, admin;
beforeEach(async () => { ctx = montar(); admin = await ctx.entrar("lucia@ciranda.app"); });
const idDe = (tabela, coluna, valor) => ctx.db.prepare(`SELECT id FROM ${tabela} WHERE ${coluna} = ?`).get(valor).id;

describe("CRUD 01: usuários", () => {
  const novo = () => ({ nome: "Thiago Villar", email: "thiago@ciranda.app", senha: "senha-forte-1", perfilId: idDe("perfis", "nome", "Cliente") });

  it("lista sem expor a senha", async () => {
    const r = await ctx.api("get", "/api/usuarios", admin);
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(3);
    expect(JSON.stringify(r.body)).not.toMatch(/senha/i);
    expect(r.body[0]).toMatchObject({ nome: "Ana Costa", perfil: "Cliente", ativo: true });
  });
  it("cria, lê, atualiza e remove", async () => {
    const criado = await ctx.api("post", "/api/usuarios", admin).send(novo());
    expect(criado.status).toBe(201);
    const id = criado.body.id;
    expect((await ctx.api("get", `/api/usuarios/${id}`, admin)).body.email).toBe("thiago@ciranda.app");
    expect(await ctx.entrar("thiago@ciranda.app", "senha-forte-1")).toEqual(expect.any(String));

    const editado = await ctx.api("put", `/api/usuarios/${id}`, admin).send({ ...novo(), nome: "Thiago V.", senha: "outra-senha-9", ativo: true });
    expect(editado.body.nome).toBe("Thiago V.");
    expect(await ctx.entrar("thiago@ciranda.app", "senha-forte-1")).toBeUndefined();
    expect(await ctx.entrar("thiago@ciranda.app", "outra-senha-9")).toEqual(expect.any(String));

    expect((await ctx.api("delete", `/api/usuarios/${id}`, admin)).status).toBe(204);
    expect((await ctx.api("get", `/api/usuarios/${id}`, admin)).status).toBe(404);
  });
  it("mantém a senha quando a edição não envia uma nova", async () => {
    const { body } = await ctx.api("post", "/api/usuarios", admin).send(novo());
    const { senha, ...semSenha } = novo();
    await ctx.api("put", `/api/usuarios/${body.id}`, admin).send({ ...semSenha, ativo: false });
    ctx.db.prepare("UPDATE usuarios SET ativo = 1 WHERE id = ?").run(body.id);
    expect(await ctx.entrar("thiago@ciranda.app", senha)).toEqual(expect.any(String));
  });
  it("valida campos, e-mail repetido e perfil inexistente", async () => {
    const invalido = await ctx.api("post", "/api/usuarios", admin).send({ nome: "Jo", email: "x", senha: "curta", perfilId: "abc" });
    expect(invalido.status).toBe(400);
    expect(Object.keys(invalido.body.detalhes).sort()).toEqual(["email", "nome", "perfilId", "senha"]);
    expect((await ctx.api("post", "/api/usuarios", admin).send({ ...novo(), email: "ana@ciranda.app" })).status).toBe(409);
    expect((await ctx.api("post", "/api/usuarios", admin).send({ ...novo(), perfilId: 999 })).status).toBe(400);
    const { body } = await ctx.api("post", "/api/usuarios", admin).send(novo());
    expect((await ctx.api("put", `/api/usuarios/${body.id}`, admin).send({ ...novo(), email: "ana@ciranda.app" })).status).toBe(409);
    expect((await ctx.api("get", "/api/usuarios/abc", admin)).status).toBe(400);
    expect((await ctx.api("post", "/api/usuarios", admin).send({ ...novo(), email: "b@b.com", ativo: "sim" })).status).toBe(400);
  });
  it("protege a própria conta", async () => {
    const eu = idDe("usuarios", "email", "lucia@ciranda.app");
    const base = { nome: "Lúcia Andrade", email: "lucia@ciranda.app", perfilId: idDe("perfis", "nome", "Administradora") };
    expect((await ctx.api("delete", `/api/usuarios/${eu}`, admin)).status).toBe(409);
    expect((await ctx.api("put", `/api/usuarios/${eu}`, admin).send({ ...base, ativo: false })).status).toBe(409);
    expect((await ctx.api("put", `/api/usuarios/${eu}`, admin).send({ ...base, perfilId: idDe("perfis", "nome", "Cliente") })).status).toBe(409);
    expect((await ctx.api("put", `/api/usuarios/${eu}`, admin).send({ ...base, nome: "Lúcia A." })).body.nome).toBe("Lúcia A.");
  });
});

describe("CRUD 02: perfis", () => {
  const ids = (...chaves) => chaves.map((c) => idDe("funcionalidades", "chave", c));

  it("lista com funcionalidades e contagem de usuários", async () => {
    const r = await ctx.api("get", "/api/perfis", admin);
    expect(r.body.map((p) => p.nome)).toEqual(["Administradora", "Cliente", "Fornecedor"]);
    expect(r.body[0]).toMatchObject({ usuarios: 1 });
    expect(r.body[0].funcionalidades).toHaveLength(9);
  });
  it("cria, lê, atualiza e remove", async () => {
    const criado = await ctx.api("post", "/api/perfis", admin).send({ nome: "Curadoria", descricao: "Avalia peças", funcionalidades: ids("catalogo.ver", "pecas.gerenciar", "catalogo.ver") });
    expect(criado.status).toBe(201);
    expect(criado.body.funcionalidades).toHaveLength(2);
    const id = criado.body.id;
    const editado = await ctx.api("put", `/api/perfis/${id}`, admin).send({ nome: "Curadoria", funcionalidades: ids("catalogo.ver") });
    expect(editado.body).toMatchObject({ descricao: "", funcionalidades: ids("catalogo.ver") });
    expect((await ctx.api("get", `/api/perfis/${id}`, admin)).body.nome).toBe("Curadoria");
    expect((await ctx.api("delete", `/api/perfis/${id}`, admin)).status).toBe(204);
    expect((await ctx.api("get", `/api/perfis/${id}`, admin)).status).toBe(404);
  });
  it("as funcionalidades do perfil valem de fato para quem o usa", async () => {
    const cliente = idDe("perfis", "nome", "Cliente");
    const ana = await ctx.entrar("ana@ciranda.app");
    expect((await ctx.api("post", "/api/pecas", ana).send({})).status).toBe(403);
    await ctx.api("put", `/api/perfis/${cliente}`, admin).send({ nome: "Cliente", funcionalidades: ids("catalogo.ver", "pecas.gerenciar") });
    expect((await ctx.api("post", "/api/pecas", ana).send({})).status).toBe(400);
  });
  it("valida nome repetido, funcionalidade inexistente e lista malformada", async () => {
    expect((await ctx.api("post", "/api/perfis", admin).send({ nome: "Cliente", funcionalidades: [] })).status).toBe(409);
    expect((await ctx.api("post", "/api/perfis", admin).send({ nome: "Novo", funcionalidades: [999] })).status).toBe(400);
    expect((await ctx.api("post", "/api/perfis", admin).send({ nome: "Novo", funcionalidades: "todas" })).status).toBe(400);
    const cliente = idDe("perfis", "nome", "Cliente");
    expect((await ctx.api("put", `/api/perfis/${cliente}`, admin).send({ nome: "Fornecedor", funcionalidades: [] })).status).toBe(409);
  });
  it("não remove perfil em uso nem deixa a pessoa se trancar para fora", async () => {
    expect((await ctx.api("delete", `/api/perfis/${idDe("perfis", "nome", "Cliente")}`, admin)).status).toBe(409);
    const adm = idDe("perfis", "nome", "Administradora");
    const r = await ctx.api("put", `/api/perfis/${adm}`, admin).send({ nome: "Administradora", funcionalidades: ids("catalogo.ver") });
    expect(r.status).toBe(409);
    expect(r.body.erro).toMatch(/seu próprio perfil/);
  });
  it("quem gerencia usuários pode listar perfis, mas não editar", async () => {
    const perfil = await ctx.api("post", "/api/perfis", admin).send({ nome: "Recursos Humanos", funcionalidades: ids("usuarios.gerenciar") });
    await ctx.api("post", "/api/usuarios", admin).send({ nome: "João Pinto", email: "joao@ciranda.app", senha: "senha-forte-1", perfilId: perfil.body.id });
    const joao = await ctx.entrar("joao@ciranda.app", "senha-forte-1");
    expect((await ctx.api("get", "/api/perfis", joao)).status).toBe(200);
    expect((await ctx.api("post", "/api/perfis", joao).send({ nome: "X", funcionalidades: [] })).status).toBe(403);
    expect((await ctx.api("get", "/api/funcionalidades", joao)).status).toBe(403);
  });
});

describe("CRUD 03: funcionalidades", () => {
  it("lista com a contagem de perfis que usam", async () => {
    const r = await ctx.api("get", "/api/funcionalidades", admin);
    expect(r.body).toHaveLength(9);
    expect(r.body.find((f) => f.chave === "catalogo.ver").perfis).toBe(3);
  });
  it("cria, lê, atualiza e remove", async () => {
    const criada = await ctx.api("post", "/api/funcionalidades", admin).send({ chave: "relatorios.ver", nome: "Ver relatórios" });
    expect(criada.status).toBe(201);
    const id = criada.body.id;
    const editada = await ctx.api("put", `/api/funcionalidades/${id}`, admin).send({ chave: "relatorios.ver", nome: "Ver relatórios", descricao: "Painel de vendas." });
    expect(editada.body.descricao).toBe("Painel de vendas.");
    expect((await ctx.api("get", `/api/funcionalidades/${id}`, admin)).body.chave).toBe("relatorios.ver");
    expect((await ctx.api("delete", `/api/funcionalidades/${id}`, admin)).status).toBe(204);
    expect((await ctx.api("get", `/api/funcionalidades/${id}`, admin)).status).toBe(404);
  });
  it("valida formato da chave, chave repetida e remoção em uso", async () => {
    const r = await ctx.api("post", "/api/funcionalidades", admin).send({ chave: "Sem Formato", nome: "X" });
    expect(r.status).toBe(400);
    expect(r.body.detalhes.chave).toMatch(/area\.acao/);
    expect((await ctx.api("post", "/api/funcionalidades", admin).send({ chave: "catalogo.ver", nome: "Repetida" })).status).toBe(409);
    const id = idDe("funcionalidades", "chave", "pecas.gerenciar");
    expect((await ctx.api("put", `/api/funcionalidades/${id}`, admin).send({ chave: "catalogo.ver", nome: "Repetida" })).status).toBe(409);
    const emUso = await ctx.api("delete", `/api/funcionalidades/${id}`, admin);
    expect(emUso.status).toBe(409);
    expect(emUso.body.erro).toMatch(/em uso/);
  });
});

describe("peças do brechó", () => {
  const nova = { titulo: "Saia midi plissada", categoria: "Saias", conservacao: "Ótimo estado", preco: 69.9 };

  it("lista e filtra por texto, categoria e situação", async () => {
    const ana = await ctx.entrar("ana@ciranda.app");
    expect((await ctx.api("get", "/api/pecas", ana)).body).toHaveLength(13);
    expect((await ctx.api("get", "/api/pecas?q=jeans", ana)).body).toHaveLength(2);
    expect((await ctx.api("get", "/api/pecas?categoria=Vestidos&situacao=Disponível", ana)).body).toHaveLength(1);
    expect((await ctx.api("get", "/api/pecas?categoria=Inexistente", ana)).status).toBe(400);
  });
  it("fornecedor cria, lê, atualiza e remove", async () => {
    const bia = await ctx.entrar("beatriz@ciranda.app");
    const criada = await ctx.api("post", "/api/pecas", bia).send(nova);
    expect(criada.status).toBe(201);
    expect(criada.body).toMatchObject({ situacao: "Disponível", voltas: 1, marca: "" });
    const id = criada.body.id;
    const editada = await ctx.api("put", `/api/pecas/${id}`, bia).send({ ...nova, preco: 59.9, situacao: "Reservada", foto: "saia-midi.webp" });
    expect(editada.body).toMatchObject({ preco: 59.9, situacao: "Reservada", foto: "saia-midi.webp" });
    expect((await ctx.api("get", `/api/pecas/${id}`, bia)).body.titulo).toBe("Saia midi plissada");
    expect((await ctx.api("delete", `/api/pecas/${id}`, bia)).status).toBe(204);
    expect((await ctx.api("get", `/api/pecas/${id}`, bia)).status).toBe(404);
  });
  it("valida preço, categoria, texto longo e nome de foto", async () => {
    const r = await ctx.api("post", "/api/pecas", admin).send({ titulo: "x".repeat(81), categoria: "Chapéus", conservacao: "Ótimo estado", preco: 0, voltas: 1.5, foto: "http://site/foto.png", marca: 5 });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.detalhes).sort()).toEqual(["categoria", "foto", "marca", "preco", "titulo", "voltas"]);
    expect((await ctx.api("post", "/api/pecas", admin).send({ ...nova, preco: "caro" })).status).toBe(400);
    expect((await ctx.api("post", "/api/pecas", admin).send({ ...nova, preco: 200000 })).status).toBe(400);
  });
});
