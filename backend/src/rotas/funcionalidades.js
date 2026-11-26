import { Router } from "express";
import { conflito, naoEncontrado, rota } from "../erros.js";
import { lerId, validar } from "../validar.js";

const REGRAS = {
  chave: { tipo: "texto", obrigatorio: true, min: 3, max: 60, padrao: /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, mensagem: "Use o formato area.acao, em minúsculas." },
  nome: { tipo: "texto", obrigatorio: true, min: 3, max: 80 },
  descricao: { tipo: "texto", max: 200 },
};

export function rotasFuncionalidades(db, auth) {
  const r = Router();
  const pode = auth.exigir("funcionalidades.gerenciar");
  const SELECT = `SELECT f.id, f.chave, f.nome, f.descricao,
    (SELECT COUNT(*) FROM perfil_funcionalidades pf WHERE pf.funcionalidade_id = f.id) AS perfis FROM funcionalidades f`;
  const listar = db.prepare(`${SELECT} ORDER BY f.chave`);
  const porId = db.prepare(`${SELECT} WHERE f.id = ?`);
  const porChave = db.prepare("SELECT id FROM funcionalidades WHERE chave = ?");
  const buscar = (id) => { const f = porId.get(id); if (!f) throw naoEncontrado("Funcionalidade"); return f; };

  // Quem gerencia perfis também precisa listar as funcionalidades para marcá-las.
  r.get("/", rota((req, res, next) => {
    const ok = ["funcionalidades.gerenciar", "perfis.gerenciar"].some((c) => req.usuario.funcionalidades.includes(c));
    if (!ok) return pode(req, res, next);
    res.json(listar.all());
  }));
  r.get("/:id", pode, rota((req, res) => res.json(buscar(lerId(req.params.id)))));

  r.post("/", pode, rota((req, res) => {
    const d = validar(req.body, REGRAS);
    if (porChave.get(d.chave)) throw conflito("Já existe uma funcionalidade com essa chave.");
    const { lastInsertRowid } = db.prepare("INSERT INTO funcionalidades (chave, nome, descricao) VALUES (?, ?, ?)").run(d.chave, d.nome, d.descricao || "");
    res.status(201).json(buscar(Number(lastInsertRowid)));
  }));

  r.put("/:id", pode, rota((req, res) => {
    const atual = buscar(lerId(req.params.id));
    const d = validar(req.body, REGRAS);
    const outra = porChave.get(d.chave);
    if (outra && outra.id !== atual.id) throw conflito("Já existe uma funcionalidade com essa chave.");
    db.prepare("UPDATE funcionalidades SET chave = ?, nome = ?, descricao = ? WHERE id = ?").run(d.chave, d.nome, d.descricao || "", atual.id);
    res.json(buscar(atual.id));
  }));

  r.delete("/:id", pode, rota((req, res) => {
    const atual = buscar(lerId(req.params.id));
    if (atual.perfis > 0) throw conflito("Esta funcionalidade está em uso por um ou mais perfis. Remova dos perfis antes.");
    db.prepare("DELETE FROM funcionalidades WHERE id = ?").run(atual.id);
    res.status(204).end();
  }));
  return r;
}
