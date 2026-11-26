import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS funcionalidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chave TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS perfis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS perfil_funcionalidades (
  perfil_id INTEGER NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  funcionalidade_id INTEGER NOT NULL REFERENCES funcionalidades(id) ON DELETE RESTRICT,
  PRIMARY KEY (perfil_id, funcionalidade_id)
);
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  perfil_id INTEGER NOT NULL REFERENCES perfis(id) ON DELETE RESTRICT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pecas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  marca TEXT NOT NULL DEFAULT '',
  tamanho TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL,
  conservacao TEXT NOT NULL,
  preco REAL NOT NULL,
  voltas INTEGER NOT NULL DEFAULT 1,
  foto TEXT NOT NULL DEFAULT '',
  situacao TEXT NOT NULL DEFAULT 'Disponível'
);
`;

export const FUNCIONALIDADES_BASE = [
  ["catalogo.ver", "Ver o catálogo", "Navegar pelas peças disponíveis."],
  ["pecas.gerenciar", "Gerenciar peças", "Cadastrar, editar e remover peças do brechó."],
  ["usuarios.gerenciar", "Gerenciar usuários", "Cadastrar, editar e remover usuários."],
  ["perfis.gerenciar", "Gerenciar perfis", "Definir perfis e o que cada um pode fazer."],
  ["funcionalidades.gerenciar", "Gerenciar funcionalidades", "Manter o cadastro de funcionalidades do sistema."],
];

const PERFIS_BASE = [
  ["Administradora", "Acesso completo ao sistema.", FUNCIONALIDADES_BASE.map((f) => f[0])],
  ["Fornecedor", "Publica e mantém as próprias peças.", ["catalogo.ver", "pecas.gerenciar"]],
  ["Cliente", "Navega pelo catálogo.", ["catalogo.ver"]],
];

const USUARIOS_BASE = [
  ["Lúcia Andrade", "lucia@ciranda.app", "Administradora"],
  ["Beatriz Ribeiro", "beatriz@ciranda.app", "Fornecedor"],
  ["Ana Costa", "ana@ciranda.app", "Cliente"],
];

const PECAS_BASE = [
  ["Camiseta listrada de algodão", "Hering", "M", "Camisetas e blusas", "Ótimo estado", 39.9, 2, "camiseta-listrada.webp"],
  ["Calça jeans reta lavagem média", "Levi's", "40", "Calças jeans", "Bom estado", 119.9, 3, "calca-jeans.webp"],
  ["Vestido midi floral", "Farm", "P", "Vestidos", "Ótimo estado", 149.0, 1, "vestido-floral.webp"],
  ["Jaqueta jeans oversized", "Zara", "G", "Jaquetas e casacos", "Bom estado", 129.9, 2, "jaqueta-jeans.webp"],
  ["Camisa de linho manga longa", "Reserva", "M", "Camisas", "Novo com etiqueta", 89.9, 1, "camisa-linho.webp"],
  ["Camiseta básica orgânica", "Insecta", "G", "Camisetas e blusas", "Ótimo estado", 24.9, 1, "camiseta-verde.webp"],
  ["Moletom Clube da Roda", "Redley", "G", "Camisetas e blusas", "Bom estado", 79.9, 3, "moletom-clube.webp"],
  ["Tênis de lona branco", "Vert", "38", "Calçados", "Bom estado", 99.9, 2, "tenis-lona.webp"],
];

export const SENHA_DEMO = "ciranda123";

// Abre o banco, cria o esquema e, se estiver vazio, grava os dados de demonstração.
export function abrirBanco(arquivo = ":memory:", { semear = true } = {}) {
  if (arquivo !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(arquivo)), { recursive: true });
  const db = new Database(arquivo);
  db.pragma("foreign_keys = ON");
  db.exec(ESQUEMA);
  if (semear && db.prepare("SELECT COUNT(*) AS n FROM perfis").get().n === 0) semearBanco(db);
  return db;
}

export function semearBanco(db) {
  const hash = bcrypt.hashSync(SENHA_DEMO, 8);
  const tx = db.transaction(() => {
    const insF = db.prepare("INSERT INTO funcionalidades (chave, nome, descricao) VALUES (?, ?, ?)");
    for (const f of FUNCIONALIDADES_BASE) insF.run(...f);
    const idF = Object.fromEntries(db.prepare("SELECT id, chave FROM funcionalidades").all().map((f) => [f.chave, f.id]));
    const insP = db.prepare("INSERT INTO perfis (nome, descricao) VALUES (?, ?)");
    const insPF = db.prepare("INSERT INTO perfil_funcionalidades (perfil_id, funcionalidade_id) VALUES (?, ?)");
    const idP = {};
    for (const [nome, descricao, chaves] of PERFIS_BASE) {
      idP[nome] = insP.run(nome, descricao).lastInsertRowid;
      for (const c of chaves) insPF.run(idP[nome], idF[c]);
    }
    const insU = db.prepare("INSERT INTO usuarios (nome, email, senha_hash, perfil_id) VALUES (?, ?, ?, ?)");
    for (const [nome, email, perfil] of USUARIOS_BASE) insU.run(nome, email, hash, idP[perfil]);
    const insPc = db.prepare("INSERT INTO pecas (titulo, marca, tamanho, categoria, conservacao, preco, voltas, foto) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (const p of PECAS_BASE) insPc.run(...p);
  });
  tx();
}
