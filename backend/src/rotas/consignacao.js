import { Router } from "express";
import { conflito, ErroHttp, naoEncontrado, rota } from "../erros.js";
import { PARTE_DO_DONO } from "../reservas.js";
import { lerId, validar } from "../validar.js";
import { CATEGORIAS, CONSERVACOES } from "./pecas.js";

const REGRAS = {
  titulo: { tipo: "texto", obrigatorio: true, min: 3, max: 80 },
  marca: { tipo: "texto", max: 40 },
  tamanho: { tipo: "texto", max: 10 },
  categoria: { tipo: "texto", obrigatorio: true, opcoes: CATEGORIAS },
  conservacao: { tipo: "texto", obrigatorio: true, opcoes: CONSERVACOES },
  preco: { tipo: "numero", obrigatorio: true, min: 0.01, max: 100000 },
};

// Consignação: a pessoa envia a peça, o brechó aprova ou recusa, e a venda gera um repasse.
export function rotasConsignacao(db, auth) {
  const r = Router();
  const publicar = auth.exigir("consignacao.publicar");
  const aprovar = auth.exigir("consignacao.aprovar");
  const aprova = (req) => req.usuario.funcionalidades.includes("consignacao.aprovar");
  // O repasse só existe depois que um pedido com a peça foi pago.
  const SELECT = `SELECT p.id, p.titulo, p.marca, p.tamanho, p.categoria, p.conservacao, p.preco, p.foto, p.situacao, p.motivo,
    p.dono_id AS donoId, u.nome AS dono,
    (SELECT i.repasse FROM pedido_itens i JOIN pedidos d ON d.id = i.pedido_id
      WHERE i.peca_id = p.id AND d.situacao IN ('Pago', 'Em separação', 'Enviado', 'Entregue') LIMIT 1) AS repasse
    FROM pecas p JOIN usuarios u ON u.id = p.dono_id`;
  const porId = db.prepare(`${SELECT} WHERE p.id = ?`);
  const buscar = (req) => {
    const p = porId.get(lerId(req.params.id));
    if (!p || (p.donoId !== req.usuario.id && !aprova(req))) throw naoEncontrado("Peça em consignação");
    return p;
  };
  const emAnalise = (p) => { if (p.situacao !== "Em análise") throw conflito("Esta peça já foi analisada."); };

  r.get("/", rota((req, res) => {
    const fila = req.query.fila === "1";
    if (fila && !aprova(req)) throw new ErroHttp(403, "Seu perfil não tem acesso a esta funcionalidade.");
    if (!fila && !req.usuario.funcionalidades.includes("consignacao.publicar")) throw new ErroHttp(403, "Seu perfil não tem acesso a esta funcionalidade.");
    res.json(fila
      ? db.prepare(`${SELECT} WHERE p.situacao = 'Em análise' ORDER BY p.id`).all()
      : db.prepare(`${SELECT} WHERE p.dono_id = ? ORDER BY p.id DESC`).all(req.usuario.id));
  }));

  r.post("/", publicar, rota((req, res) => {
    const d = validar(req.body, REGRAS);
    const { lastInsertRowid } = db.prepare(`INSERT INTO pecas (titulo, marca, tamanho, categoria, conservacao, preco, situacao, dono_id)
      VALUES (@titulo, @marca, @tamanho, @categoria, @conservacao, @preco, 'Em análise', @dono)`)
      .run({ marca: "", tamanho: "", ...d, dono: req.usuario.id });
    res.status(201).json({ ...porId.get(Number(lastInsertRowid)), parteDoDono: PARTE_DO_DONO });
  }));

  r.post("/:id/aprovar", aprovar, rota((req, res) => {
    const p = buscar(req);
    emAnalise(p);
    db.prepare("UPDATE pecas SET situacao = 'Disponível', motivo = '' WHERE id = ?").run(p.id);
    res.json(porId.get(p.id));
  }));

  r.post("/:id/recusar", aprovar, rota((req, res) => {
    const p = buscar(req);
    emAnalise(p);
    const { motivo } = validar(req.body, { motivo: { tipo: "texto", obrigatorio: true, min: 3, max: 200 } });
    db.prepare("UPDATE pecas SET situacao = 'Recusada', motivo = ? WHERE id = ?").run(motivo, p.id);
    res.json(porId.get(p.id));
  }));

  // Quem enviou pode desistir enquanto a peça não entrou no catálogo.
  r.delete("/:id", publicar, rota((req, res) => {
    const p = buscar(req);
    if (p.donoId !== req.usuario.id) throw new ErroHttp(403, "Só quem enviou a peça pode retirá-la.");
    if (!["Em análise", "Recusada"].includes(p.situacao)) throw conflito("Esta peça já está no catálogo. Fale com o brechó para retirá-la.");
    db.prepare("DELETE FROM pecas WHERE id = ?").run(p.id);
    res.status(204).end();
  }));
  return r;
}
