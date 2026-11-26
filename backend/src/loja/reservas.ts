import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from "@nestjs/common";
import { from, switchMap } from "rxjs";
import type { Prisma } from "../banco/cliente/client.js";
import { PrismaService } from "../banco/prisma.service.js";
import { CONFIG, type Config } from "../config.js";

// Regras de tempo da loja: quanto dura uma reserva e o que acontece quando ela vence.
export const MINUTOS_DE_RESERVA = 30;
export const PRAZO_MS = MINUTOS_DE_RESERVA * 60 * 1000;
// Parte do preço que volta para quem deixou a peça em consignação.
export const PARTE_DO_DONO = 0.6;
// Situações de um pedido que já foi pago.
export const PAGOS = ["Pago", "Em separação", "Enviado", "Entregue"];
export const centavos = (n: number | null | undefined) => Math.round((n || 0) * 100) / 100;

type Tx = Prisma.TransactionClient;

@Injectable()
export class ReservasService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(CONFIG) private readonly config: Config) {}

  /** Devolve as peças de um pedido ao catálogo, muda a situação dele e registra o motivo na linha do tempo. */
  async soltarPedido(tx: Tx, pedidoId: number, situacao: string, etapa: string) {
    const itens = await tx.pedidoItem.findMany({ where: { pedidoId, pecaId: { not: null } }, select: { pecaId: true } });
    await tx.peca.updateMany({ where: { id: { in: itens.map((i) => i.pecaId!) }, situacao: "Reservada" }, data: { situacao: "Disponível" } });
    await tx.pedido.update({ where: { id: pedidoId }, data: { situacao } });
    await tx.pedidoEvento.create({ data: { pedidoId, etapa, quando: new Date(this.config.agora()) } });
  }

  // Devolve ao catálogo o que venceu: itens parados na sacola e pedidos que não foram pagos.
  // Roda antes das rotas da loja, então ninguém vê uma reserva vencida.
  async liberarVencidas() {
    const agora = new Date(this.config.agora());
    const [naSacola, pedidos] = await Promise.all([
      this.prisma.sacolaItem.findMany({ where: { reservadaAte: { lte: agora } }, select: { pecaId: true } }),
      this.prisma.pedido.findMany({ where: { situacao: "Aguardando pagamento", expiraEm: { lte: agora } }, select: { id: true } }),
    ]);
    if (!naSacola.length && !pedidos.length) return;
    await this.prisma.$transaction(async (tx) => {
      const ids = naSacola.map((s) => s.pecaId);
      await tx.peca.updateMany({ where: { id: { in: ids }, situacao: "Reservada" }, data: { situacao: "Disponível" } });
      await tx.sacolaItem.deleteMany({ where: { pecaId: { in: ids } } });
      for (const { id } of pedidos) await this.soltarPedido(tx, id, "Expirado", "Reserva vencida sem pagamento");
    });
  }
}

/** Interceptador das rotas da loja: solta as reservas vencidas antes de a rota responder. */
@Injectable()
export class EmDia implements NestInterceptor {
  constructor(@Inject(ReservasService) private readonly reservas: ReservasService) {}

  intercept(_contexto: ExecutionContext, proximo: CallHandler) {
    return from(this.reservas.liberarVencidas()).pipe(switchMap(() => proximo.handle()));
  }
}
