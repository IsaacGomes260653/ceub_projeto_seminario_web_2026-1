-- CreateTable
CREATE TABLE "tbl_001_usuarios" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil_id" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tbl_001_usuarios_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "tbl_002_perfis" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tbl_002_perfis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "tbl_003_funcionalidades" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "tbl_004_perfis_funcionalidades" (
    "perfil_id" INTEGER NOT NULL,
    "funcionalidade_id" INTEGER NOT NULL,

    PRIMARY KEY ("perfil_id", "funcionalidade_id"),
    CONSTRAINT "tbl_004_perfis_funcionalidades_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "tbl_002_perfis" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tbl_004_perfis_funcionalidades_funcionalidade_id_fkey" FOREIGN KEY ("funcionalidade_id") REFERENCES "tbl_003_funcionalidades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tbl_005_pecas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT NOT NULL,
    "marca" TEXT NOT NULL DEFAULT '',
    "tamanho" TEXT NOT NULL DEFAULT '',
    "categoria" TEXT NOT NULL,
    "conservacao" TEXT NOT NULL,
    "preco" REAL NOT NULL,
    "voltas" INTEGER NOT NULL DEFAULT 1,
    "foto" TEXT NOT NULL DEFAULT '',
    "situacao" TEXT NOT NULL DEFAULT 'Disponível',
    "dono_id" INTEGER,
    "motivo" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "tbl_005_pecas_dono_id_fkey" FOREIGN KEY ("dono_id") REFERENCES "tbl_001_usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tbl_006_sacola_itens" (
    "peca_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuario_id" INTEGER NOT NULL,
    "reservada_ate" DATETIME NOT NULL,
    CONSTRAINT "tbl_006_sacola_itens_peca_id_fkey" FOREIGN KEY ("peca_id") REFERENCES "tbl_005_pecas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tbl_006_sacola_itens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "tbl_001_usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tbl_007_pedidos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuario_id" INTEGER NOT NULL,
    "total" REAL NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'Aguardando pagamento',
    "pix" TEXT NOT NULL,
    "rastreio" TEXT NOT NULL DEFAULT '',
    "pontos" INTEGER NOT NULL DEFAULT 0,
    "agua" REAL NOT NULL DEFAULT 0,
    "co2" REAL NOT NULL DEFAULT 0,
    "expira_em" DATETIME NOT NULL,
    "criado_em" DATETIME NOT NULL,
    CONSTRAINT "tbl_007_pedidos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "tbl_001_usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tbl_008_pedidos_itens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pedido_id" INTEGER NOT NULL,
    "peca_id" INTEGER,
    "titulo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "preco" REAL NOT NULL,
    "dono_id" INTEGER,
    "repasse" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "tbl_008_pedidos_itens_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "tbl_007_pedidos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tbl_008_pedidos_itens_peca_id_fkey" FOREIGN KEY ("peca_id") REFERENCES "tbl_005_pecas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tbl_008_pedidos_itens_dono_id_fkey" FOREIGN KEY ("dono_id") REFERENCES "tbl_001_usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tbl_009_pedidos_eventos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pedido_id" INTEGER NOT NULL,
    "etapa" TEXT NOT NULL,
    "quando" DATETIME NOT NULL,
    CONSTRAINT "tbl_009_pedidos_eventos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "tbl_007_pedidos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tbl_010_sessoes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" DATETIME NOT NULL,
    "criada_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tbl_010_sessoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "tbl_001_usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_001_usuarios_email_key" ON "tbl_001_usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_002_perfis_nome_key" ON "tbl_002_perfis"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_003_funcionalidades_chave_key" ON "tbl_003_funcionalidades"("chave");

-- CreateIndex
CREATE INDEX "tbl_005_pecas_situacao_idx" ON "tbl_005_pecas"("situacao");

-- CreateIndex
CREATE INDEX "tbl_006_sacola_itens_usuario_id_idx" ON "tbl_006_sacola_itens"("usuario_id");

-- CreateIndex
CREATE INDEX "tbl_007_pedidos_usuario_id_idx" ON "tbl_007_pedidos"("usuario_id");

-- CreateIndex
CREATE INDEX "tbl_008_pedidos_itens_pedido_id_idx" ON "tbl_008_pedidos_itens"("pedido_id");

-- CreateIndex
CREATE INDEX "tbl_009_pedidos_eventos_pedido_id_idx" ON "tbl_009_pedidos_eventos"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_010_sessoes_token_hash_key" ON "tbl_010_sessoes"("token_hash");

-- CreateIndex
CREATE INDEX "tbl_010_sessoes_usuario_id_idx" ON "tbl_010_sessoes"("usuario_id");
