import request from "supertest";
import { criarApp } from "../src/app.js";
import { lerConfig } from "../src/config.js";
import { abrirBanco, SENHA_DEMO } from "../src/db.js";

export const CHAVE = "chave-de-teste";

// Cada teste recebe um banco em memória novo: os testes não dependem um do outro.
export function montar(extra = {}) {
  const config = { ...lerConfig({ API_KEY: CHAVE, JWT_SEGREDO: "segredo-de-teste", CORS_ORIGENS: "http://localhost:5173" }), ...extra };
  const db = abrirBanco(":memory:");
  const app = criarApp(db, config);
  const api = (metodo, caminho, token) => {
    const r = request(app)[metodo](caminho).set("X-API-Key", CHAVE);
    return token ? r.set("Authorization", `Bearer ${token}`) : r;
  };
  const entrar = async (email, senha = SENHA_DEMO) => (await api("post", "/api/auth/login").send({ email, senha })).body.token;
  return { app, db, config, api, entrar };
}
