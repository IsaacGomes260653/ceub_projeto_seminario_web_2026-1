import request from "supertest";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { lerConfig } from "../src/config.js";
import { CHAVE, montar } from "./apoio.js";

describe("chave de API", () => {
  it("recusa requisição sem chave", async () => {
    const { app } = montar();
    const r = await request(app).post("/api/auth/login").send({ email: "lucia@ciranda.app", senha: "ciranda123" });
    expect(r.status).toBe(401);
    expect(r.body.erro).toMatch(/Chave de API/);
  });
  it("recusa chave errada, inclusive de mesmo tamanho", async () => {
    const { app } = montar();
    const r = await request(app).get("/api/pecas").set("X-API-Key", "x".repeat(CHAVE.length));
    expect(r.status).toBe(401);
  });
  it("deixa a rota de saúde aberta", async () => {
    const { app } = montar();
    const r = await request(app).get("/api/saude");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });
});

describe("CORS", () => {
  it("libera a origem da lista", async () => {
    const { app } = montar();
    const r = await request(app).get("/api/saude").set("Origin", "http://localhost:5173");
    expect(r.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });
  it("bloqueia origem fora da lista", async () => {
    const { app } = montar();
    const r = await request(app).get("/api/saude").set("Origin", "https://site-malicioso.example");
    expect(r.status).toBe(403);
    expect(r.headers["access-control-allow-origin"]).toBeUndefined();
  });
  it("responde ao preflight com os métodos e cabeçalhos permitidos", async () => {
    const { app } = montar();
    const r = await request(app).options("/api/usuarios").set("Origin", "http://localhost:5173").set("Access-Control-Request-Method", "DELETE");
    expect(r.status).toBe(204);
    expect(r.headers["access-control-allow-methods"]).toContain("DELETE");
    expect(r.headers["access-control-allow-headers"]).toContain("X-API-Key");
  });
});

describe("cabeçalhos de segurança", () => {
  it("envia CSP restritiva e não revela a tecnologia", async () => {
    const { app } = montar();
    const r = await request(app).get("/api/saude");
    expect(r.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("tokens", () => {
  it("exige token nas rotas protegidas", async () => {
    const { api } = montar();
    expect((await api("get", "/api/pecas")).status).toBe(401);
  });
  it("recusa token adulterado ou assinado com outro segredo", async () => {
    const { api } = montar();
    const falso = jwt.sign({ sub: "1" }, "outro-segredo");
    expect((await api("get", "/api/pecas", falso)).status).toBe(401);
    expect((await api("get", "/api/pecas", "nao-e-um-token")).status).toBe(401);
  });
  it("recusa token expirado com mensagem própria", async () => {
    const { api, config } = montar();
    const vencido = jwt.sign({ sub: "1" }, config.jwtSegredo, { expiresIn: -10 });
    const r = await api("get", "/api/pecas", vencido);
    expect(r.status).toBe(401);
    expect(r.body.erro).toMatch(/expirada/);
  });
  it("recusa esquema diferente de Bearer", async () => {
    const { app } = montar();
    const r = await request(app).get("/api/pecas").set("X-API-Key", CHAVE).set("Authorization", "Basic abc");
    expect(r.status).toBe(401);
  });
  it("deixa de valer quando o usuário é desativado", async () => {
    const { api, entrar, db } = montar();
    const token = await entrar("ana@ciranda.app");
    db.prepare("UPDATE usuarios SET ativo = 0 WHERE email = 'ana@ciranda.app'").run();
    expect((await api("get", "/api/pecas", token)).status).toBe(401);
  });
});

describe("filtro de camada 7", () => {
  it.each([
    ["script no corpo", { email: "<script>alert(1)</script>", senha: "x" }],
    ["injeção de SQL no corpo", { email: "a@a.com", senha: "' OR 1=1" }],
    ["evento em atributo", { email: "a@a.com", senha: "<img onerror=alert(1)>" }],
    ["valor aninhado", { email: "a@a.com", senha: ["ok", { x: "UNION ALL SELECT senha" }] }],
  ])("bloqueia %s", async (_nome, corpo) => {
    const { api } = montar();
    const r = await api("post", "/api/auth/login").send(corpo);
    expect(r.status).toBe(400);
    expect(r.body.erro).toMatch(/filtro de segurança/);
  });
  it("bloqueia ataque na URL e na busca", async () => {
    const { api, entrar } = montar();
    const token = await entrar("ana@ciranda.app");
    expect((await api("get", "/api/pecas?q=<script>x</script>", token)).status).toBe(400);
    expect((await api("get", "/api/pecas/..%2F..%2Fetc", token)).status).toBe(400);
    expect((await api("get", "/api/pecas?q=%E0%A4%A", token)).status).toBe(400);
  });
  it("deixa passar texto comum com apóstrofo e acento", async () => {
    const { api, entrar } = montar();
    const token = await entrar("ana@ciranda.app");
    const r = await api("get", "/api/pecas?q=Levi's", token);
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);
  });
});

describe("limites", () => {
  it("corta tentativas de login em excesso", async () => {
    const { api } = montar({ limiteLoginPorMinuto: 3 });
    const tentar = () => api("post", "/api/auth/login").send({ email: "lucia@ciranda.app", senha: "errada-demais" });
    for (let i = 0; i < 3; i++) expect((await tentar()).status).toBe(401);
    const r = await tentar();
    expect(r.status).toBe(429);
    expect(r.body.erro).toMatch(/tentativas de login/);
  });
  it("recusa corpo grande demais e JSON quebrado", async () => {
    const { app } = montar();
    const grande = await request(app).post("/api/auth/login").set("X-API-Key", CHAVE).send({ email: "a@a.com", senha: "x".repeat(200_000) });
    expect(grande.status).toBe(413);
    const quebrado = await request(app).post("/api/auth/login").set("X-API-Key", CHAVE).set("Content-Type", "application/json").send("{quebrado");
    expect(quebrado.status).toBe(400);
    expect(quebrado.body.erro).toBe("JSON inválido.");
  });
  it("devolve 404 em rota desconhecida", async () => {
    const { api } = montar();
    expect((await api("get", "/api/nao-existe")).status).toBe(404);
  });
});

describe("configuração", () => {
  it("exige segredos em produção", () => {
    expect(() => lerConfig({ NODE_ENV: "production" })).toThrow(/JWT_SEGREDO/);
    expect(lerConfig({ NODE_ENV: "production", JWT_SEGREDO: "a", API_KEY: "b", CORS_ORIGENS: "https://a.com, https://b.com" }).corsOrigens).toEqual(["https://a.com", "https://b.com"]);
  });
});

describe("configuração atrás de proxy", () => {
  it("na Vercel confia no proxy e libera o próprio endereço no CORS", async () => {
    const { lerConfig } = await import("../src/config.js");
    const { criarApp } = await import("../src/app.js");
    const { abrirBanco } = await import("../src/db.js");
    const config = lerConfig({ VERCEL: "1", VERCEL_URL: "ciranda-web-abc.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "ciranda-web.vercel.app" });
    expect(config.atrasDeProxy).toBe(true);
    expect(config.corsOrigens).toEqual(expect.arrayContaining(["https://ciranda-web.vercel.app", "https://ciranda-web-abc.vercel.app"]));
    expect(criarApp(abrirBanco(":memory:"), config).get("trust proxy")).toBe(1);
    expect(lerConfig({}).atrasDeProxy).toBe(false);
    expect(lerConfig({ ATRAS_DE_PROXY: "1" }).atrasDeProxy).toBe(true);
  });
});
