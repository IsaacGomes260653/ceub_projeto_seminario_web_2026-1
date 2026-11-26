import { Router } from "express";
import bcrypt from "bcryptjs";
import { conflito, invalido, naoEncontrado, rota } from "../erros.js";
import { lerId, validar } from "../validar.js";

const REGRAS = {
  nome: { tipo: "texto", obrigatorio: true, min: 3, max: 80 },
  email: { tipo: "email", obrigatorio: true, max: 120 },
  perfilId: { tipo: "inteiro", obrigatorio: true, min: 1 },
  ativo: { tipo: "booleano" },
};
const SENHA = { tipo: "texto", min: 8, max: 200 };

export function rotasUsuarios(db, auth) {
  const r = Router();
  r.use(auth.exigir("usuarios.gerenciar"));
  // A senha nunca sai da API: o SELECT não inclui o hash.
  const SELECT = `SELECT u.id, u.nome, u.email, u.perfil_id AS perfilId, p.nome AS perfil, u.ativo, u.criado_em AS criadoEm
    FROM usuarios u JOIN perfis p ON p.id = u.perfil_id`;
  const listar = db.prepare(`${SELECT} ORDER BY u.nome`);
  const porId = db.prepare(`${SELECT} WHERE u.id = ?`);
  const porEmail = db.prepare("SELECT id FROM usuarios WHERE email = ?");
  const existePerfil = db.prepare("SELECT id FROM perfis WHERE id = ?");
  const formatar = (u) => ({ ...u, ativo: Boolean(u.ativo) });
  const buscar = (id) => { const u = porId.get(id); if (!u) throw naoEncontrado("Usuário"); return formatar(u); };
  const conferirPerfil = (id) => { if (!existePerfil.get(id)) throw invalido({ perfilId: "Perfil inexistente." }); };

  r.get("/", rota((_req, res) => res.json(listar.all().map(formatar))));
  r.get("/:id", rota((req, res) => res.json(buscar(lerId(req.params.id)))));

  r.post("/", rota((req, res) => {
    const d = validar(req.body, { ...REGRAS, senha: { ...SENHA, obrigatorio: true } });
    if (porEmail.get(d.email)) throw conflito("Já existe um usuário com esse e-mail.");
    conferirPerfil(d.perfilId);
    const { lastInsertRowid } = db.prepare("INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo) VALUES (?, ?, ?, ?, ?)")
      .run(d.nome, d.email, bcrypt.hashSync(d.senha, 10), d.perfilId, d.ativo === false ? 0 : 1);
    res.status(201).json(buscar(Number(lastInsertRowid)));
  }));

  r.put("/:id", rota((req, res) => {
    const atual = buscar(lerId(req.params.id));
    const d = validar(req.body, { ...REGRAS, senha: SENHA });
    const outro = porEmail.get(d.email);
    if (outro && outro.id !== atual.id) throw conflito("Já existe um usuário com esse e-mail.");
    conferirPerfil(d.perfilId);
    const ativo = d.ativo === undefined ? atual.ativo : d.ativo;
    if (atual.id === req.usuario.id && (!ativo || d.perfilId !== atual.perfilId)) {
      throw conflito("Você não pode desativar a própria conta nem trocar o próprio perfil.");
    }
    db.prepare("UPDATE usuarios SET nome = ?, email = ?, perfil_id = ?, ativo = ? WHERE id = ?").run(d.nome, d.email, d.perfilId, ativo ? 1 : 0, atual.id);
    if (d.senha) db.prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?").run(bcrypt.hashSync(d.senha, 10), atual.id);
    res.json(buscar(atual.id));
  }));

  r.delete("/:id", rota((req, res) => {
    const atual = buscar(lerId(req.params.id));
    if (atual.id === req.usuario.id) throw conflito("Você não pode remover a própria conta.");
    db.prepare("DELETE FROM usuarios WHERE id = ?").run(atual.id);
    res.status(204).end();
  }));
  return r;
}
