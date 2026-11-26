import { describe, expect, it } from "vitest";
import { montar } from "./apoio.js";

describe("login", () => {
  it("entra com credenciais certas e devolve usuário com funcionalidades", async () => {
    const { api } = montar();
    const r = await api("post", "/api/auth/login").send({ email: "LUCIA@ciranda.app", senha: "ciranda123" });
    expect(r.status).toBe(200);
    expect(r.body.token).toEqual(expect.any(String));
    expect(r.body.usuario).toMatchObject({ nome: "Lúcia Andrade", perfil: "Administradora" });
    expect(r.body.usuario.funcionalidades).toContain("usuarios.gerenciar");
    expect(r.body.usuario).not.toHaveProperty("senhaHash");
  });
  it("dá a mesma resposta para senha errada e e-mail inexistente", async () => {
    const { api } = montar();
    const a = await api("post", "/api/auth/login").send({ email: "lucia@ciranda.app", senha: "senha-errada" });
    const b = await api("post", "/api/auth/login").send({ email: "ninguem@ciranda.app", senha: "senha-errada" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });
  it("valida os campos", async () => {
    const { api } = montar();
    const r = await api("post", "/api/auth/login").send({ email: "sem-arroba" });
    expect(r.status).toBe(400);
    expect(r.body.detalhes).toMatchObject({ email: "E-mail inválido.", senha: "Campo obrigatório." });
  });
  it("não deixa entrar usuário inativo", async () => {
    const { api, db } = montar();
    db.prepare("UPDATE usuarios SET ativo = 0 WHERE email = 'ana@ciranda.app'").run();
    expect((await api("post", "/api/auth/login").send({ email: "ana@ciranda.app", senha: "ciranda123" })).status).toBe(401);
  });
  it("devolve o usuário da sessão em /eu", async () => {
    const { api, entrar } = montar();
    const r = await api("get", "/api/auth/eu", await entrar("beatriz@ciranda.app"));
    expect(r.body.usuario).toMatchObject({ email: "beatriz@ciranda.app", perfil: "Fornecedor", funcionalidades: ["catalogo.ver", "pecas.gerenciar", "sacola.usar", "consignacao.publicar"] });
  });
});

describe("autorização por funcionalidade", () => {
  it("cliente só vê o catálogo", async () => {
    const { api, entrar } = montar();
    const t = await entrar("ana@ciranda.app");
    expect((await api("get", "/api/pecas", t)).status).toBe(200);
    for (const caminho of ["/api/usuarios", "/api/perfis", "/api/funcionalidades"]) {
      const r = await api("get", caminho, t);
      expect(r.status).toBe(403);
      expect(r.body.erro).toMatch(/perfil não tem acesso/);
    }
    expect((await api("post", "/api/pecas", t).send({})).status).toBe(403);
  });
  it("mudar o perfil vale na requisição seguinte, sem novo login", async () => {
    const { api, entrar, db } = montar();
    const t = await entrar("ana@ciranda.app");
    expect((await api("get", "/api/usuarios", t)).status).toBe(403);
    db.prepare("UPDATE usuarios SET perfil_id = (SELECT id FROM perfis WHERE nome = 'Administradora') WHERE email = 'ana@ciranda.app'").run();
    expect((await api("get", "/api/usuarios", t)).status).toBe(200);
  });
});
