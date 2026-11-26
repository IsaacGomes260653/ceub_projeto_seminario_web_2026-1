import { Router } from "express";
import { conflito, naoEncontrado, rota } from "../erros.js";
import { PRAZO_MS } from "../reservas.js";
import { lerId, validar } from "../validar.js";

// Sacola: colocar uma peça nela reserva a peça por 30 minutos para aquela pessoa.
export function rotasSacola(db, auth, config, reservas) {
  const r = Router();
  r.use(auth.exigir("sacola.usar"), reservas.emDia);
  const itens = db.prepare(`SELECT p.id, p.titulo, p.marca, p.tamanho, p.categoria, p.preco, p.foto, s.reservada_ate AS reservadaAte
    FROM sacola_itens s JOIN pecas p ON p.id = s.peca_id WHERE s.usuario_id = ? ORDER BY s.reservada_ate, p.id`);
  const peca = db.prepare("SELECT id, situacao, dono_id AS donoId FROM pecas WHERE id = ?");
  const doUsuario = db.prepare("SELECT peca_id FROM sacola_itens WHERE peca_id = ? AND usuario_id = ?");
  const ver = (usuarioId) => {
    const lista = itens.all(usuarioId);
    return { itens: lista, total: Math.round(lista.reduce((t, i) => t + i.preco, 0) * 100) / 100 };
  };

  r.get("/", rota((req, res) => res.json(ver(req.usuario.id))));

  r.post("/", rota((req, res) => {
    const { pecaId } = validar(req.body, { pecaId: { tipo: "inteiro", obrigatorio: true, min: 1 } });
    const colocar = db.transaction(() => {
      const p = peca.get(pecaId);
      if (!p || ["Em análise", "Recusada"].includes(p.situacao)) throw naoEncontrado("Peça");
      if (doUsuario.get(pecaId, req.usuario.id)) return;
      if (p.donoId === req.usuario.id) throw conflito("Esta peça é sua. Ela não pode ir para a sua sacola.");
      if (p.situacao !== "Disponível") throw conflito(p.situacao === "Vendida" ? "Esta peça já foi vendida." : "Esta peça acabou de ser reservada por outra pessoa.");
      db.prepare("UPDATE pecas SET situacao = 'Reservada' WHERE id = ?").run(pecaId);
      db.prepare("INSERT INTO sacola_itens (peca_id, usuario_id, reservada_ate) VALUES (?, ?, ?)").run(pecaId, req.usuario.id, config.agora() + PRAZO_MS);
    });
    colocar();
    res.status(201).json(ver(req.usuario.id));
  }));

  r.delete("/:pecaId", rota((req, res) => {
    const pecaId = lerId(req.params.pecaId);
    if (!doUsuario.get(pecaId, req.usuario.id)) throw naoEncontrado("Item da sacola");
    const tirar = db.transaction(() => {
      db.prepare("DELETE FROM sacola_itens WHERE peca_id = ?").run(pecaId);
      db.prepare("UPDATE pecas SET situacao = 'Disponível' WHERE id = ? AND situacao = 'Reservada'").run(pecaId);
    });
    tirar();
    res.json(ver(req.usuario.id));
  }));
  return r;
}
