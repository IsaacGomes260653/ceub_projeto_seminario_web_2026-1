import { Router } from "express";
import crypto from "node:crypto";
import { conflito, ErroHttp, naoEncontrado, rota } from "../erros.js";
import { somarImpacto } from "../impacto.js";
import { PARTE_DO_DONO, PRAZO_MS } from "../reservas.js";
import { lerId } from "../validar.js";

// Depois de pago, o pedido anda por estas etapas, uma de cada vez.
export const ETAPAS = ["Pago", "Em separação", "Enviado", "Entregue"];
const EVENTO = { "Em separação": "Peças separadas e embaladas", "Enviado": "Pacote postado", "Entregue": "Pedido entregue" };
const centavos = (n) => Math.round(n * 100) / 100;

// Pedidos: nascem da sacola, são pagos com um Pix simulado e seguem uma linha do tempo.
export function rotasPedidos(db, auth, config, reservas) {
  const r = Router();
  r.use(reservas.emDia);
  const comprar = auth.exigir("sacola.usar");
  const bastidores = auth.exigir("bastidores.ver");
  const veTudo = (req) => req.usuario.funcionalidades.includes("bastidores.ver");
  const CAMPOS = `p.id, p.usuario_id AS usuarioId, u.nome AS cliente, p.total, p.situacao, p.pix, p.rastreio, p.pontos, p.agua, p.co2,
    p.expira_em AS expiraEm, p.criado_em AS criadoEm`;
  const porId = db.prepare(`SELECT ${CAMPOS} FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id WHERE p.id = ?`);
  const itensDe = db.prepare("SELECT peca_id AS pecaId, titulo, categoria, preco FROM pedido_itens WHERE pedido_id = ? ORDER BY id");
  const eventosDe = db.prepare("SELECT etapa, quando FROM pedido_eventos WHERE pedido_id = ? ORDER BY id");
  const completo = (p) => ({ ...p, itens: itensDe.all(p.id), eventos: eventosDe.all(p.id) });
  // Pedido de outra pessoa responde como inexistente, para não revelar que o número existe.
  const buscar = (req) => {
    const p = porId.get(lerId(req.params.id));
    if (!p || (p.usuarioId !== req.usuario.id && !veTudo(req))) throw naoEncontrado("Pedido");
    return p;
  };
  const meu = (req) => {
    const p = buscar(req);
    if (p.usuarioId !== req.usuario.id) throw new ErroHttp(403, "Só quem fez o pedido pode fazer isso.");
    return p;
  };

  r.get("/", rota((req, res) => {
    const todos = req.query.todos === "1";
    if (todos && !veTudo(req)) throw new ErroHttp(403, "Seu perfil não tem acesso a esta funcionalidade.");
    if (!todos && !req.usuario.funcionalidades.includes("sacola.usar")) throw new ErroHttp(403, "Seu perfil não tem acesso a esta funcionalidade.");
    const lista = todos
      ? db.prepare(`SELECT ${CAMPOS} FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id ORDER BY p.id DESC`).all()
      : db.prepare(`SELECT ${CAMPOS} FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id WHERE p.usuario_id = ? ORDER BY p.id DESC`).all(req.usuario.id);
    res.json(lista.map(completo));
  }));

  r.get("/:id", rota((req, res) => res.json(completo(buscar(req)))));

  // Fecha a sacola: as peças continuam reservadas, agora presas ao pedido, até o Pix ou o prazo.
  r.post("/", comprar, rota((req, res) => {
    const fechar = db.transaction(() => {
      const itens = db.prepare(`SELECT p.id, p.titulo, p.categoria, p.preco, p.dono_id AS donoId
        FROM sacola_itens s JOIN pecas p ON p.id = s.peca_id WHERE s.usuario_id = ? ORDER BY s.reservada_ate, p.id`).all(req.usuario.id);
      if (!itens.length) throw conflito("Sua sacola está vazia.");
      const agora = config.agora();
      const total = centavos(itens.reduce((t, i) => t + i.preco, 0));
      const pix = `PIX-SIMULADO-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
      const id = Number(db.prepare("INSERT INTO pedidos (usuario_id, total, pix, expira_em, criado_em) VALUES (?, ?, ?, ?, ?)")
        .run(req.usuario.id, total, pix, agora + PRAZO_MS, agora).lastInsertRowid);
      const ins = db.prepare("INSERT INTO pedido_itens (pedido_id, peca_id, titulo, categoria, preco, dono_id, repasse) VALUES (?, ?, ?, ?, ?, ?, ?)");
      for (const i of itens) ins.run(id, i.id, i.titulo, i.categoria, i.preco, i.donoId, i.donoId ? centavos(i.preco * PARTE_DO_DONO) : 0);
      db.prepare("DELETE FROM sacola_itens WHERE usuario_id = ?").run(req.usuario.id);
      reservas.registrar.run(id, "Pedido criado", agora);
      return id;
    });
    res.status(201).json(completo(porId.get(fechar())));
  }));

  // Pagamento simulado: nenhum dinheiro circula. Confirmar marca as peças como vendidas e credita os pontos.
  r.post("/:id/pagar", comprar, rota((req, res) => {
    const p = meu(req);
    if (p.situacao !== "Aguardando pagamento") throw conflito(p.situacao === "Expirado" ? "A reserva venceu antes do pagamento. Monte a sacola de novo." : "Este pedido não está aguardando pagamento.");
    const pagar = db.transaction(() => {
      const itens = itensDe.all(p.id);
      const impacto = somarImpacto(itens.map((i) => i.categoria));
      const rastreio = `CR${String(crypto.randomInt(0, 1e9)).padStart(9, "0")}BR`;
      db.prepare("UPDATE pedidos SET situacao = 'Pago', rastreio = ?, pontos = ?, agua = ?, co2 = ? WHERE id = ?").run(rastreio, impacto.pontos, impacto.agua, impacto.co2, p.id);
      // Cada venda é mais uma volta da peça.
      const vender = db.prepare("UPDATE pecas SET situacao = 'Vendida', voltas = voltas + 1 WHERE id = ?");
      for (const i of itens) if (i.pecaId) vender.run(i.pecaId);
      reservas.registrar.run(p.id, "Pagamento confirmado", config.agora());
    });
    pagar();
    res.json(completo(porId.get(p.id)));
  }));

  r.post("/:id/cancelar", comprar, rota((req, res) => {
    const p = meu(req);
    if (p.situacao !== "Aguardando pagamento") throw conflito("Só dá para cancelar um pedido que ainda não foi pago.");
    db.transaction(() => reservas.soltarPedido(p.id, "Cancelado", "Pedido cancelado"))();
    res.json(completo(porId.get(p.id)));
  }));

  // Quem cuida dos bastidores move o pedido para a etapa seguinte.
  r.post("/:id/avancar", bastidores, rota((req, res) => {
    const p = buscar(req);
    const i = ETAPAS.indexOf(p.situacao);
    if (i < 0) throw conflito("Só um pedido pago pode avançar.");
    if (i === ETAPAS.length - 1) throw conflito("Este pedido já foi entregue.");
    const proxima = ETAPAS[i + 1];
    db.transaction(() => {
      db.prepare("UPDATE pedidos SET situacao = ? WHERE id = ?").run(proxima, p.id);
      reservas.registrar.run(p.id, EVENTO[proxima], config.agora());
    })();
    res.json(completo(porId.get(p.id)));
  }));
  return r;
}
