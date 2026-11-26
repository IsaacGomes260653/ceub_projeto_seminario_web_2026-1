import { Router } from "express";
import { rota } from "../erros.js";

const PAGOS = "('Pago', 'Em separação', 'Enviado', 'Entregue')";
const centavos = (n) => Math.round((n || 0) * 100) / 100;

// Duas leituras de números: o impacto de quem compra e o painel de quem cuida do brechó.
export function rotasPainel(db, auth, reservas) {
  const impacto = Router();
  const bastidores = Router();

  impacto.get("/", reservas.emDia, auth.exigir("sacola.usar"), rota((req, res) => {
    const t = db.prepare(`SELECT COUNT(*) AS pedidos, COALESCE(SUM(pontos), 0) AS pontos, COALESCE(SUM(agua), 0) AS agua, COALESCE(SUM(co2), 0) AS co2
      FROM pedidos WHERE usuario_id = ? AND situacao IN ${PAGOS}`).get(req.usuario.id);
    const pecas = db.prepare(`SELECT COUNT(*) AS n FROM pedido_itens i JOIN pedidos d ON d.id = i.pedido_id WHERE d.usuario_id = ? AND d.situacao IN ${PAGOS}`).get(req.usuario.id).n;
    res.json({ pedidos: t.pedidos, pecas, pontos: t.pontos, agua: t.agua, co2: Math.round(t.co2 * 10) / 10 });
  }));

  bastidores.get("/", reservas.emDia, auth.exigir("bastidores.ver"), rota((_req, res) => {
    const contar = (sql) => Object.fromEntries(db.prepare(sql).all().map((l) => [l.situacao, l.n]));
    const v = db.prepare(`SELECT COALESCE(SUM(total), 0) AS faturamento, COALESCE(SUM(agua), 0) AS agua, COALESCE(SUM(co2), 0) AS co2, COALESCE(SUM(pontos), 0) AS pontos
      FROM pedidos WHERE situacao IN ${PAGOS}`).get();
    const repasses = db.prepare(`SELECT u.nome AS dono, COUNT(*) AS pecas, SUM(i.repasse) AS valor FROM pedido_itens i
      JOIN pedidos d ON d.id = i.pedido_id JOIN usuarios u ON u.id = i.dono_id
      WHERE d.situacao IN ${PAGOS} AND i.repasse > 0 GROUP BY u.id ORDER BY valor DESC`).all().map((l) => ({ ...l, valor: centavos(l.valor) }));
    const devido = centavos(repasses.reduce((t, l) => t + l.valor, 0));
    res.json({
      pecas: contar("SELECT situacao, COUNT(*) AS n FROM pecas GROUP BY situacao"),
      pedidos: contar("SELECT situacao, COUNT(*) AS n FROM pedidos GROUP BY situacao"),
      faturamento: centavos(v.faturamento),
      repasseDevido: devido,
      ficaNoBrecho: centavos(v.faturamento - devido),
      repasses,
      agua: v.agua, co2: Math.round(v.co2 * 10) / 10, pontos: v.pontos,
    });
  }));
  return { impacto, bastidores };
}
