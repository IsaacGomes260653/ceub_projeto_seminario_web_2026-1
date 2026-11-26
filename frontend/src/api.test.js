import { afterEach, describe, expect, it, vi } from "vitest";
import { api, chamar, definirAoExpirar, ErroDeApi, sessaoGuardada } from "./api.js";

const resposta = (status, corpo) => ({ ok: status < 400, status, json: async () => corpo });
afterEach(() => { vi.unstubAllGlobals(); definirAoExpirar(() => {}); });

describe("camada de API", () => {
  it("envia a chave de API e, quando há sessão, o token", async () => {
    const buscar = vi.fn().mockResolvedValue(resposta(200, []));   // mock: só observa a chamada
    vi.stubGlobal("fetch", buscar);
    await api.listar("/pecas");
    expect(buscar.mock.calls[0][1].headers).toEqual({ "X-API-Key": "ciranda-dev-key" });
    sessaoGuardada.gravar("abc");
    await api.criar("/pecas", { titulo: "x" });
    expect(buscar.mock.calls[1][1].headers).toEqual({ "X-API-Key": "ciranda-dev-key", "Content-Type": "application/json", Authorization: "Bearer abc" });
    expect(buscar.mock.calls[1][1].body).toBe('{"titulo":"x"}');
  });
  it("monta a consulta só com filtros preenchidos", async () => {
    const buscar = vi.fn().mockResolvedValue(resposta(200, []));
    vi.stubGlobal("fetch", buscar);
    await api.listar("/pecas", { q: "calça jeans", categoria: "", situacao: null });
    expect(buscar.mock.calls[0][0]).toBe("/api/pecas?q=cal%C3%A7a+jeans");
  });
  it("usa os verbos certos para atualizar e remover, e devolve nulo no 204", async () => {
    const buscar = vi.fn().mockResolvedValueOnce(resposta(200, { id: 7 })).mockResolvedValueOnce(resposta(204));
    vi.stubGlobal("fetch", buscar);
    expect(await api.atualizar("/perfis", 7, { nome: "x" })).toEqual({ id: 7 });
    expect(await api.remover("/perfis", 7)).toBeNull();
    expect(buscar.mock.calls.map((c) => [c[1].method, c[0]])).toEqual([["PUT", "/api/perfis/7"], ["DELETE", "/api/perfis/7"]]);
  });
  it("transforma erro da API em ErroDeApi com status e detalhes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(400, { erro: "Dados inválidos.", detalhes: { nome: "Campo obrigatório." } })));
    const erro = await api.criar("/perfis", {}).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect(erro).toMatchObject({ status: 400, message: "Dados inválidos.", detalhes: { nome: "Campo obrigatório." } });
  });
  it("dá mensagem própria quando a rede falha ou a resposta não é JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("falha de rede")));
    await expect(chamar("GET", "/pecas")).rejects.toMatchObject({ status: 0, message: expect.stringMatching(/conexão/) });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error("html"); } }));
    await expect(chamar("GET", "/pecas")).rejects.toMatchObject({ status: 502, message: "Algo deu errado.", detalhes: {} });
  });
  it("avisa que a sessão expirou só quando havia token e não era o login", async () => {
    const aoExpirar = vi.fn();
    definirAoExpirar(aoExpirar);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(401, { erro: "E-mail ou senha incorretos." })));
    await api.entrar("a@a.com", "x").catch(() => {});
    await api.listar("/pecas").catch(() => {});
    expect(aoExpirar).not.toHaveBeenCalled();
    sessaoGuardada.gravar("vencido");
    await api.entrar("a@a.com", "x").catch(() => {});
    expect(aoExpirar).not.toHaveBeenCalled();
    await api.listar("/pecas").catch(() => {});
    expect(aoExpirar).toHaveBeenCalledTimes(1);
  });
  it("segue funcionando se o navegador bloquear o armazenamento", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error("bloqueado"); };
    Storage.prototype.setItem = () => { throw new Error("bloqueado"); };
    expect(sessaoGuardada.ler()).toBeNull();
    expect(() => sessaoGuardada.gravar("x")).not.toThrow();
    Storage.prototype.getItem = original;
    delete Storage.prototype.setItem;
  });
});
