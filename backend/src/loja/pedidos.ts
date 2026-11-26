import { Controller, Get, HttpCode, Inject, Injectable, Param, Post, Query, UseInterceptors } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import crypto from "node:crypto";
import type { UsuarioDaSessao } from "../auth/auth.service.js";
import { PrismaService } from "../banco/prisma.service.js";
import { conflito, ErroHttp, naoEncontrado, semAcesso } from "../comum/erros.js";
import { Autenticado, ComChaveDeApi, Exigir, Usuario } from "../comum/guardas.js";
import { somarImpacto } from "../comum/impacto.js";
import { lerId } from "../comum/validar.js";
import { CONFIG, type Config } from "../config.js";
import { centavos, EmDia, PAGOS, PARTE_DO_DONO, PRAZO_MS, ReservasService } from "./reservas.js";

// Depois de pago, o pedido anda por estas etapas, uma de cada vez.
export const ETAPAS = PAGOS;
const EVENTO: Record<string, string> = { "Em separação": "Peças separadas e embaladas", "Enviado": "Pacote postado", "Entregue": "Pedido entregue" };
const SITUACOES_DO_PEDIDO = ["Aguardando pagamento", ...PAGOS, "Cancelado", "Expirado"];

export class PedidoItemDto {
  @ApiProperty({ type: Number, nullable: true }) pecaId!: number | null;
  @ApiProperty({ type: String }) titulo!: string;
  @ApiProperty({ type: String }) categoria!: string;
  @ApiProperty({ type: Number }) preco!: number;
  @ApiProperty({ type: String }) foto!: string;
}
export class PedidoEventoDto {
  @ApiProperty({ type: String, example: "Pagamento confirmado" }) etapa!: string;
  @ApiProperty({ type: Number, description: "Quando aconteceu, em milissegundos." }) quando!: number;
}
export class PedidoDto {
  @ApiProperty({ type: Number }) id!: number;
  @ApiProperty({ type: Number }) usuarioId!: number;
  @ApiProperty({ type: String }) cliente!: string;
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: String, enum: SITUACOES_DO_PEDIDO }) situacao!: string;
  @ApiProperty({ type: String, description: "Código do Pix simulado." }) pix!: string;
  @ApiProperty({ type: String, description: "Código de rastreio simulado, depois do pagamento." }) rastreio!: string;
  @ApiProperty({ type: Number }) pontos!: number;
  @ApiProperty({ type: Number, description: "Litros de água poupados." }) agua!: number;
  @ApiProperty({ type: Number, description: "Quilos de CO2 evitados." }) co2!: number;
  @ApiProperty({ type: Number }) expiraEm!: number;
  @ApiProperty({ type: Number }) criadoEm!: number;
  @ApiProperty({ type: [PedidoItemDto] }) itens!: PedidoItemDto[];
  @ApiProperty({ type: [PedidoEventoDto] }) eventos!: PedidoEventoDto[];
}

// Pedidos: nascem da sacola, são pagos com um Pix simulado e seguem uma linha do tempo.
@Injectable()
export class PedidosService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(ReservasService) private readonly reservas: ReservasService,
  ) {}

  private readonly incluir = {
    usuario: { select: { nome: true } },
    itens: { orderBy: { id: "asc" as const }, include: { peca: { select: { foto: true } } } },
    eventos: { orderBy: { id: "asc" as const } },
  };
  private formatar = (p: any) => ({
    id: p.id, usuarioId: p.usuarioId, cliente: p.usuario.nome, total: p.total, situacao: p.situacao, pix: p.pix, rastreio: p.rastreio,
    pontos: p.pontos, agua: p.agua, co2: p.co2, expiraEm: p.expiraEm.getTime(), criadoEm: p.criadoEm.getTime(),
    itens: p.itens.map((i: any) => ({ pecaId: i.pecaId, titulo: i.titulo, categoria: i.categoria, preco: i.preco, foto: i.peca?.foto || "" })),
    eventos: p.eventos.map((e: any) => ({ etapa: e.etapa, quando: e.quando.getTime() })),
  });
  private veTudo = (quem: UsuarioDaSessao) => quem.funcionalidades.includes("bastidores.ver");
  private completo = async (id: number) => this.formatar(await this.prisma.pedido.findUniqueOrThrow({ where: { id }, include: this.incluir }));

  async listar(todos: boolean, quem: UsuarioDaSessao) {
    if (todos ? !this.veTudo(quem) : !quem.funcionalidades.includes("sacola.usar")) throw semAcesso();
    const lista = await this.prisma.pedido.findMany({ where: todos ? {} : { usuarioId: quem.id }, include: this.incluir, orderBy: { id: "desc" } });
    return lista.map(this.formatar);
  }

  // Pedido de outra pessoa responde como inexistente, para não revelar que o número existe.
  async buscar(id: number, quem: UsuarioDaSessao) {
    const p = await this.prisma.pedido.findUnique({ where: { id }, include: this.incluir });
    if (!p || (p.usuarioId !== quem.id && !this.veTudo(quem))) throw naoEncontrado("Pedido");
    return this.formatar(p);
  }

  private async meu(id: number, quem: UsuarioDaSessao) {
    const p = await this.buscar(id, quem);
    if (p.usuarioId !== quem.id) throw new ErroHttp(403, "Só quem fez o pedido pode fazer isso.");
    return p;
  }

  // Fecha a sacola: as peças continuam reservadas, agora presas ao pedido, até o Pix ou o prazo.
  async fechar(quem: UsuarioDaSessao) {
    const id = await this.prisma.$transaction(async (tx) => {
      const sacola = await tx.sacolaItem.findMany({ where: { usuarioId: quem.id }, include: { peca: true }, orderBy: [{ reservadaAte: "asc" }, { pecaId: "asc" }] });
      if (!sacola.length) throw conflito("Sua sacola está vazia.");
      const agora = this.config.agora();
      const pedido = await tx.pedido.create({
        data: {
          usuarioId: quem.id,
          total: centavos(sacola.reduce((t, s) => t + s.peca.preco, 0)),
          pix: `PIX-SIMULADO-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
          expiraEm: new Date(agora + PRAZO_MS),
          criadoEm: new Date(agora),
          itens: { create: sacola.map(({ peca: p }) => ({ pecaId: p.id, titulo: p.titulo, categoria: p.categoria, preco: p.preco, donoId: p.donoId, repasse: p.donoId ? centavos(p.preco * PARTE_DO_DONO) : 0 })) },
          eventos: { create: { etapa: "Pedido criado", quando: new Date(agora) } },
        },
      });
      await tx.sacolaItem.deleteMany({ where: { usuarioId: quem.id } });
      return pedido.id;
    });
    return this.completo(id);
  }

  // Pagamento simulado: nenhum dinheiro circula. Confirmar marca as peças como vendidas e credita os pontos.
  async pagar(id: number, quem: UsuarioDaSessao) {
    const p = await this.meu(id, quem);
    if (p.situacao !== "Aguardando pagamento") throw conflito(p.situacao === "Expirado" ? "A reserva venceu antes do pagamento. Monte a sacola de novo." : "Este pedido não está aguardando pagamento.");
    const impacto = somarImpacto(p.itens.map((i: any) => i.categoria));
    await this.prisma.$transaction(async (tx) => {
      // Dois cliques seguidos em pagar: só o primeiro encontra o pedido ainda aguardando.
      const { count } = await tx.pedido.updateMany({
        where: { id: p.id, situacao: "Aguardando pagamento" },
        data: { situacao: "Pago", rastreio: `CR${String(crypto.randomInt(0, 1e9)).padStart(9, "0")}BR`, pontos: impacto.pontos, agua: impacto.agua, co2: impacto.co2 },
      });
      if (!count) throw conflito("Este pedido não está aguardando pagamento.");
      // Cada venda é mais uma volta da peça.
      const ids = p.itens.map((i: any) => i.pecaId).filter(Boolean);
      await tx.peca.updateMany({ where: { id: { in: ids } }, data: { situacao: "Vendida", voltas: { increment: 1 } } });
      await tx.pedidoEvento.create({ data: { pedidoId: p.id, etapa: "Pagamento confirmado", quando: new Date(this.config.agora()) } });
    });
    return this.completo(p.id);
  }

  async cancelar(id: number, quem: UsuarioDaSessao) {
    const p = await this.meu(id, quem);
    if (p.situacao !== "Aguardando pagamento") throw conflito("Só dá para cancelar um pedido que ainda não foi pago.");
    await this.prisma.$transaction((tx) => this.reservas.soltarPedido(tx, p.id, "Cancelado", "Pedido cancelado"));
    return this.completo(p.id);
  }

  // Quem cuida dos bastidores move o pedido para a etapa seguinte.
  async avancar(id: number, quem: UsuarioDaSessao) {
    const p = await this.buscar(id, quem);
    const i = ETAPAS.indexOf(p.situacao);
    if (i < 0) throw conflito("Só um pedido pago pode avançar.");
    if (i === ETAPAS.length - 1) throw conflito("Este pedido já foi entregue.");
    const proxima = ETAPAS[i + 1];
    await this.prisma.$transaction([
      this.prisma.pedido.update({ where: { id: p.id }, data: { situacao: proxima } }),
      this.prisma.pedidoEvento.create({ data: { pedidoId: p.id, etapa: EVENTO[proxima], quando: new Date(this.config.agora()) } }),
    ]);
    return this.completo(p.id);
  }
}

@ApiTags("Pedidos")
@ComChaveDeApi()
@Autenticado()
@UseInterceptors(EmDia)
@Controller("api/pedidos")
export class PedidosController {
  constructor(@Inject(PedidosService) private readonly servico: PedidosService) {}

  @Get()
  @ApiOperation({ summary: "Lista os próprios pedidos", description: "Com todos=1, lista os pedidos de todo mundo. Só para quem tem bastidores.ver." })
  @ApiQuery({ name: "todos", required: false, enum: ["1"] })
  @ApiResponse({ status: 200, type: [PedidoDto] })
  @ApiResponse({ status: 403, description: "Perfil sem sacola.usar, ou sem bastidores.ver quando todos=1." })
  listar(@Query("todos") todos: string, @Usuario() quem: UsuarioDaSessao) { return this.servico.listar(todos === "1", quem); }

  @Get(":id")
  @ApiOperation({ summary: "Busca um pedido", description: "Pedido de outra pessoa responde 404." })
  @ApiResponse({ status: 200, type: PedidoDto })
  buscar(@Param("id") id: string, @Usuario() quem: UsuarioDaSessao) { return this.servico.buscar(lerId(id), quem); }

  @Post()
  @Exigir("sacola.usar")
  @ApiOperation({ summary: "Fecha a sacola em um pedido", description: "Gera o código do Pix simulado e dá 30 minutos para pagar." })
  @ApiResponse({ status: 201, type: PedidoDto })
  @ApiResponse({ status: 409, description: "Sacola vazia." })
  fechar(@Usuario() quem: UsuarioDaSessao) { return this.servico.fechar(quem); }

  @Post(":id/pagar")
  @HttpCode(200)
  @Exigir("sacola.usar")
  @ApiOperation({ summary: "Confirma o Pix simulado", description: "Vende as peças, gera o rastreio e credita os pontos. Nenhum dinheiro circula." })
  @ApiResponse({ status: 200, type: PedidoDto })
  @ApiResponse({ status: 409, description: "Pedido que não está aguardando pagamento." })
  pagar(@Param("id") id: string, @Usuario() quem: UsuarioDaSessao) { return this.servico.pagar(lerId(id), quem); }

  @Post(":id/cancelar")
  @HttpCode(200)
  @Exigir("sacola.usar")
  @ApiOperation({ summary: "Cancela um pedido ainda não pago" })
  @ApiResponse({ status: 200, type: PedidoDto })
  cancelar(@Param("id") id: string, @Usuario() quem: UsuarioDaSessao) { return this.servico.cancelar(lerId(id), quem); }

  @Post(":id/avancar")
  @HttpCode(200)
  @Exigir("bastidores.ver")
  @ApiOperation({ summary: "Move o pedido para a etapa seguinte", description: "Pago, Em separação, Enviado, Entregue." })
  @ApiResponse({ status: 200, type: PedidoDto })
  avancar(@Param("id") id: string, @Usuario() quem: UsuarioDaSessao) { return this.servico.avancar(lerId(id), quem); }
}
