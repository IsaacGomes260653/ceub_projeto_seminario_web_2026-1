import { defineConfig } from "prisma/config";

// Configuração do Prisma (CLI): onde está o esquema, onde ficam as migrations e qual banco elas alteram.
// O endereço vem do ambiente. O padrão é um arquivo SQLite local, só para desenvolvimento.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL || "file:./dados/ciranda.db" },
});
