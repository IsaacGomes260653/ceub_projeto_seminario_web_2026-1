import "reflect-metadata";
import request from "supertest";
import { criarApp } from "../src/app.ts";
import { PrismaService } from "../src/banco/prisma.service.ts";
import { SENHA_DEMO } from "../src/banco/semente.ts";
import { lerConfig } from "../src/config.ts";

const { DatabaseSync } = process.getBuiltinModule("node:sqlite");

export const CHAVE = "chave-de-teste";
export const abertos = [];

// Cada teste recebe uma aplicação Nest inteira com um banco novo: os testes não dependem um do outro.
// "db" é uma segunda conexão ao mesmo arquivo, em SQL puro, para o teste preparar e conferir o banco por fora da API.
export async function montar(extra = {}) {
  const config = { ...lerConfig({ API_KEY: CHAVE, JWT_SEGREDO: "segredo-de-teste", CORS_ORIGENS: "http://localhost:5173", CUSTO_DO_HASH: "4" }), ...extra };
  const { app, servidor } = await criarApp(config);
  const prisma = app.get(PrismaService);
  const arquivo = prisma.endereco.replace(/^file:/, "");
  const db = new DatabaseSync(arquivo);
  db.exec("PRAGMA foreign_keys = ON");
  abertos.push({ app, db, arquivo });
  const api = (metodo, caminho, token) => {
    const r = request(servidor)[metodo](caminho).set("X-API-Key", CHAVE);
    return token ? r.set("Authorization", `Bearer ${token}`) : r;
  };
  const entrar = async (email, senha = SENHA_DEMO) => (await api("post", "/api/auth/login").send({ email, senha })).body.token;
  return { app: servidor, nest: app, prisma, db, config, api, entrar };
}
