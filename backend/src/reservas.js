// Regras de tempo da loja: quanto dura uma reserva e o que acontece quando ela vence.
export const MINUTOS_DE_RESERVA = 30;
export const PRAZO_MS = MINUTOS_DE_RESERVA * 60 * 1000;
// Parte do preço que volta para quem deixou a peça em consignação.
export const PARTE_DO_DONO = 0.6;

// Devolve ao catálogo o que venceu: itens parados na sacola e pedidos que não foram pagos.
// É chamada no começo das rotas da loja, então ninguém vê uma reserva vencida.
export function criarReservas(db, config) {
  const soltarPeca = db.prepare("UPDATE pecas SET situacao = 'Disponível' WHERE id = ? AND situacao = 'Reservada'");
  const vencidosNaSacola = db.prepare("SELECT peca_id AS pecaId FROM sacola_itens WHERE reservada_ate <= ?");
  const tirarDaSacola = db.prepare("DELETE FROM sacola_itens WHERE peca_id = ?");
  const pedidosVencidos = db.prepare("SELECT id FROM pedidos WHERE situacao = 'Aguardando pagamento' AND expira_em <= ?");
  const pecasDoPedido = db.prepare("SELECT peca_id AS pecaId FROM pedido_itens WHERE pedido_id = ? AND peca_id IS NOT NULL");
  const marcarPedido = db.prepare("UPDATE pedidos SET situacao = ? WHERE id = ?");
  const registrar = db.prepare("INSERT INTO pedido_eventos (pedido_id, etapa, quando) VALUES (?, ?, ?)");

  const soltarPedido = (id, situacao, etapa) => {
    for (const { pecaId } of pecasDoPedido.all(id)) soltarPeca.run(pecaId);
    marcarPedido.run(situacao, id);
    registrar.run(id, etapa, config.agora());
  };

  const liberarVencidas = db.transaction(() => {
    const agora = config.agora();
    for (const { pecaId } of vencidosNaSacola.all(agora)) { soltarPeca.run(pecaId); tirarDaSacola.run(pecaId); }
    for (const { id } of pedidosVencidos.all(agora)) soltarPedido(id, "Expirado", "Reserva vencida sem pagamento");
  });

  // Vale como middleware do Express.
  const emDia = (_req, _res, next) => { liberarVencidas(); next(); };
  return { liberarVencidas, emDia, soltarPedido, registrar };
}
