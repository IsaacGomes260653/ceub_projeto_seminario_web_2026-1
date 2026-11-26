import { Controller, Get, Inject, Injectable, UseInterceptors } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { UsuarioDaSessao } from "../auth/auth.service.js";
import { PrismaService } from "../banco/prisma.service.js";
import { Autenticado, ComChaveDeApi, Usuario } from "../comum/guardas.js";
import { centavos, EmDia, PAGOS } from "./reservas.js";

export class ImpactoDto {
  @ApiProperty({ type: Number, description: "Pedidos pagos." }) pedidos!: number;
  @ApiProperty({ type: Number }) pecas!: number;
  @ApiProperty({ type: Number }) pontos!: number;
  @ApiProperty({ type: Number, description: "Litros de água poupados." }) agua!: number;
  @ApiProperty({ type: Number, description: "Quilos de CO2 evitados." }) co2!: number;
}
export class RepasseDto {
  @ApiProperty({ type: String }) dono!: string;
  @ApiProperty({ type: Number }) pecas!: number;
  @ApiProperty({ type: Number }) valor!: number;
}
export class BastidoresDto {
  @ApiProperty({ type: Object, example: { "Disponível": 11, "Vendida": 2 } }) pecas!: Record<string, number>;
  @ApiProperty({ type: Object, example: { Pago: 1 } }) pedidos!: Record<string, number>;
  @ApiProperty({ type: Number }) faturamento!: number;
  @ApiProperty({ type: Number }) repasseDevido!: number;
  @ApiProperty({ type: Number }) ficaNoBrecho!: number;
  @ApiProperty({ type: [RepasseDto] }) repasses!: RepasseDto[];
  @ApiProperty({ type: Number }) agua!: number;
  @ApiProperty({ type: Number }) co2!: number;
  @ApiProperty({ type: Number }) pontos!: number;
}

// Duas leituras de números: o impacto de quem compra e o painel de quem cuida do brechó.
@Injectable()
export class PainelService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async impacto(quem: UsuarioDaSessao) {
    const meus = { usuarioId: quem.id, situacao: { in: PAGOS } };
    const [t, pecas] = await Promise.all([
      this.prisma.pedido.aggregate({ where: meus, _count: true, _sum: { pontos: true, agua: true, co2: true } }),
      this.prisma.pedidoItem.count({ where: { pedido: meus } }),
    ]);
    return { pedidos: t._count, pecas, pontos: t._sum.pontos || 0, agua: t._sum.agua || 0, co2: Math.round((t._sum.co2 || 0) * 10) / 10 };
  }

  async bastidores() {
    const pagos = { situacao: { in: PAGOS } };
    const contar = (linhas: { situacao: string; _count: number }[]) => Object.fromEntries(linhas.map((l) => [l.situacao, l._count]));
    const [pecas, pedidos, v, porDono] = await Promise.all([
      this.prisma.peca.groupBy({ by: ["situacao"], _count: true }),
      this.prisma.pedido.groupBy({ by: ["situacao"], _count: true }),
      this.prisma.pedido.aggregate({ where: pagos, _sum: { total: true, agua: true, co2: true, pontos: true } }),
      this.prisma.pedidoItem.groupBy({ by: ["donoId"], where: { pedido: pagos, repasse: { gt: 0 }, donoId: { not: null } }, _count: true, _sum: { repasse: true } }),
    ]);
    const nomes = Object.fromEntries((await this.prisma.usuario.findMany({ where: { id: { in: porDono.map((l) => l.donoId!) } }, select: { id: true, nome: true } })).map((u) => [u.id, u.nome]));
    const repasses = porDono.map((l) => ({ dono: nomes[l.donoId!], pecas: l._count, valor: centavos(l._sum.repasse) })).sort((a, b) => b.valor - a.valor);
    const faturamento = centavos(v._sum.total);
    const repasseDevido = centavos(repasses.reduce((t, l) => t + l.valor, 0));
    return {
      pecas: contar(pecas), pedidos: contar(pedidos), faturamento, repasseDevido, ficaNoBrecho: centavos(faturamento - repasseDevido), repasses,
      agua: v._sum.agua || 0, co2: Math.round((v._sum.co2 || 0) * 10) / 10, pontos: v._sum.pontos || 0,
    };
  }
}

@ApiTags("Painéis")
@ComChaveDeApi()
@UseInterceptors(EmDia)
@Controller("api")
export class PainelController {
  constructor(@Inject(PainelService) private readonly servico: PainelService) {}

  @Get("impacto")
  @Autenticado("sacola.usar")
  @ApiOperation({ summary: "O que as compras da pessoa já pouparam" })
  @ApiResponse({ status: 200, type: ImpactoDto })
  impacto(@Usuario() quem: UsuarioDaSessao) { return this.servico.impacto(quem); }

  @Get("bastidores")
  @Autenticado("bastidores.ver")
  @ApiOperation({ summary: "Painel do brechó", description: "Vendido, a repassar, peças e pedidos por situação." })
  @ApiResponse({ status: 200, type: BastidoresDto })
  bastidores() { return this.servico.bastidores(); }
}
