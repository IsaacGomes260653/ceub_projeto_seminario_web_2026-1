import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import fs from "node:fs";
import path from "node:path";
import { CONFIG, type Config, enderecoDoBanco } from "../config.js";
import { PrismaClient } from "./cliente/client.js";
import { MIGRACOES } from "./migracoes.js";
import { semear } from "./semente.js";

// Único ponto de acesso ao banco. Todo o resto da API fala com o banco por aqui, pelo cliente do Prisma,
// que monta consultas parametrizadas: valor digitado pela pessoa nunca é colado dentro do SQL.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  readonly endereco: string;

  constructor(@Inject(CONFIG) private readonly config: Config) {
    const endereco = enderecoDoBanco(config.banco);
    const arquivo = endereco.replace(/^file:/, "");
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    super({ adapter: new PrismaLibSql({ url: endereco }) });
    this.endereco = endereco;
  }

  async onModuleInit() {
    await this.$connect();
    // O SQLite só respeita as chaves estrangeiras (e o ON DELETE CASCADE) com isto ligado.
    await this.$executeRawUnsafe("PRAGMA foreign_keys = ON");
    await this.migrarSeVazio();
    if ((await this.perfil.count()) === 0) await semear(this, this.config.custoDoHash);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Banco novo: aplica as migrations do Prisma, na ordem. Banco que já tem as tabelas (criado por
  // "prisma migrate deploy", por exemplo) fica como está. O SQL vem do repositório, nunca de uma requisição.
  private async migrarSeVazio() {
    const existe = await this.$queryRaw<{ name: string }[]>`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tbl_001_usuarios'`;
    if (existe.length) return;
    for (const { sql } of MIGRACOES) {
      const comandos = sql.split("\n").filter((linha) => !linha.trim().startsWith("--")).join("\n").split(/;\s*(?:\n|$)/).map((c) => c.trim()).filter(Boolean);
      for (const comando of comandos) await this.$executeRawUnsafe(comando);
    }
  }
}
