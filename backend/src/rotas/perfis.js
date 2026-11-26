import { Router } from "express";
import { conflito, invalido, naoEncontrado, rota } from "../erros.js";
import { lerId, validar } from "../validar.js";

const REGRAS = {
  nome: { tipo: "texto", obrigatorio: true, min: 3, max: 60 },
  descricao: { tipo: "texto", max: 200 },
  funcionalidades: { tipo: "lista-inteiros", obrigatorio: true },
};

export function rotasPerfis(db, auth) {
  const r = Router();
  const pode = auth.exigir("perfis.gerenciar");
  const SELECT = `SELECT p.id, p.nome, p.descricao,
    (SELECT COUNT(*) FROM usuarios u WHERE u.perfil_id = p.id) AS usuarios FROM perfis p`;
  const listar = db.prepare(`${SELECT} ORDER BY p.nome`);
  const porId = db.prepare(`${SELECT} WHERE p.id = ?`);
  const porNome = db.prepare("SELECT id FROM perfis WHERE nome = ?");
  const idsDoPerfil = db.prepare("SELECT funcionalidade_id AS id FROM perfil_funcionalidades WHERE perfil_id = ? ORDER BY funcionalidade_id");
  const existeF = db.prepare("SELECT id FROM funcionalidades WHERE id = ?");
  const completar = (p) => ({ ...p, funcionalidades: idsDoPerfil.all(p.id).map((f) => f.id) });
  const buscar = (id) => { const p = porId.get(id); if (!p) throw naoEncontrado("Perfil"); return completar(p); };

  function conferirFuncionalidades(ids) {
    const faltando = ids.filter((id) => !existeF.get(id));
    if (faltando.length) throw invalido({ funcionalidades: `Funcionalidade inexistente: ${faltando.join(", ")}.` });
  }
  const gravarFuncionalidades = (perfilId, ids) => {
    db.prepare("DELETE FROM perfil_funcionalidades WHERE perfil_id = ?").run(perfilId);
    const ins = db.prepare("INSERT INTO perfil_funcionalidades (perfil_id, funcionalidade_id) VALUES (?, ?)");
    for (const id of ids) ins.run(perfilId, id);
  };

  // Quem gerencia usuários também precisa listar os perfis para escolher um.
  r.get("/", rota((req, res, next) => {
    const ok = ["perfis.gerenciar", "usuarios.gerenciar"].some((c) => req.usuario.funcionalidades.includes(c));
    if (!ok) return pode(req, res, next);
    res.json(listar.all().map(completar));
  }));
  r.get("/:id", pode, rota((req, res) => res.json(buscar(lerId(req.params.id)))));

  r.post("/", pode, rota((req, res) => {
    const d = validar(req.body, REGRAS);
    if (porNome.get(d.nome)) throw conflito("Já existe um perfil com esse nome.");
    conferirFuncionalidades(d.funcionalidades);
    const id = db.transaction(() => {
      const novo = Number(db.prepare("INSERT INTO perfis (nome, descricao) VALUES (?, ?)").run(d.nome, d.descricao || "").lastInsertRowid);
      gravarFuncionalidades(novo, d.funcionalidades);
      return novo;
    })();
    res.status(201).json(buscar(id));
  }));

  r.put("/:id", pode, rota((req, res) => {
    const atual = buscar(lerId(req.params.id));
    const d = validar(req.body, REGRAS);
    const outro = porNome.get(d.nome);
    if (outro && outro.id !== atual.id) throw conflito("Já existe um perfil com esse nome.");
    conferirFuncionalidades(d.funcionalidades);
    // Impede que a pessoa tire de si mesma o acesso à gestão de perfis e fique trancada para fora.
    const idGerenciar = db.prepare("SELECT id FROM funcionalidades WHERE chave = 'perfis.gerenciar'").get()?.id;
    if (atual.id === req.usuario.perfilId && !d.funcionalidades.includes(idGerenciar)) {
      throw conflito("Você não pode remover a gestão de perfis do seu próprio perfil.");
    }
    db.transaction(() => {
      db.prepare("UPDATE perfis SET nome = ?, descricao = ? WHERE id = ?").run(d.nome, d.descricao || "", atual.id);
      gravarFuncionalidades(atual.id, d.funcionalidades);
    })();
    res.json(buscar(atual.id));
  }));

  r.delete("/:id", pode, rota((req, res) => {
    const atual = buscar(lerId(req.params.id));
    if (atual.usuarios > 0) throw conflito("Há usuários com este perfil. Troque o perfil deles antes de remover.");
    db.prepare("DELETE FROM perfis WHERE id = ?").run(atual.id);
    res.status(204).end();
  }));
  return r;
}
