import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Param, Post, Query } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiProperty, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { UsuarioDaSessao } from "../auth/auth.service.js";
import { PrismaService } from "../banco/prisma.service.js";
import { conflito, ErroHttp, naoEncontrado, semAcesso } from "../comum/erros.js";
import { Autenticado, ComChaveDeApi, Exigir, Usuario } from "../comum/guardas.js";
import { lerId, type Regras, validar } from "../comum/validar.js";
import { CATEGORIAS, CONSERVACOES } from "../pecas/pecas.js";
import { PAGOS, PARTE_DO_DONO } from "./reservas.js";

const REGRAS: Regras = {
  titulo: { tipo: "texto", obrigatorio: true, min: 3, max: 80 },
  marca: { tipo: "texto", max: 40 },
  tamanho: { tipo: "texto", max: 10 },
  categoria: { tipo: "texto", obrigatorio: true, opcoes: CATEGORIAS },
  conservacao: { tipo: "texto", obrigatorio: true, opcoes: CONSERVACOES },
  preco: { tipo: "numero", obrigatorio: true, min: 0.01, max: 100000 },
};

export class ConsignacaoEntradaDto {
  @ApiProperty({ type: String, example: "Bolsa de couro caramelo", minLength: 3, maxLength: 80 }) titulo!: string;
  @ApiProperty({ type: String, required: false, maxLength: 40 }) marca?: string;
  @ApiProperty({ type: String, required: false, maxLength: 10 }) tamanho?: string;
  @ApiProperty({ type: String, enum: CATEGORIAS }) categoria!: string;
  @ApiProperty({ type: String, enum: CONSERVACOES }) conservacao!: string;
  @ApiProperty({ type: Number, example: 180, minimum: 0.01 }) preco!: number;
}
export class RecusaDto {
  @ApiProperty({ type: String, example: "Zíper quebrado.", minLength: 3, maxLength: 200 }) motivo!: string;
}
export class ConsignacaoDto extends ConsignacaoEntradaDto {
  @ApiProperty({ type: Number }) id!: number;
  @ApiProperty({ type: String }) foto!: string;
  @ApiProperty({ type: String, example: "Em análise" }) situacao!: string;
  @ApiProperty({ type: String }) motivo!: string;
  @ApiProperty({ type: Number }) donoId!: number;
  @ApiProperty({ type: String }) dono!: string;
  @ApiProperty({ type: Number, nullable: true, description: "Valor do repasse. Só existe depois que a peça é vendida." }) repasse!: number | null;
}

// Consignação: a pessoa envia a peça, o brechó aprova ou recusa, e a venda gera um repasse.
@Injectable()
export class ConsignacaoService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // O repasse só existe depois que um pedido com a peça foi pago.
  private readonly incluir = { dono: { select: { nome: true } }, itens: { where: { pedido: { situacao: { in: PAGOS } } }, select: { repasse: true }, take: 1 } };
  private formatar = (p: any) => ({
    id: p.id, titulo: p.titulo, marca: p.marca, tamanho: p.tamanho, categoria: p.categoria, conservacao: p.conservacao, preco: p.preco, foto: p.foto,
    situacao: p.situacao, motivo: p.motivo, donoId: p.donoId, dono: p.dono.nome, repasse: p.itens[0]?.repasse ?? null,
  });
  private aprova = (quem: UsuarioDaSessao) => quem.funcionalidades.includes("consignacao.aprovar");

  async listar(fila: boolean, quem: UsuarioDaSessao) {
    if (fila ? !this.aprova(quem) : !quem.funcionalidades.includes("consignacao.publicar")) throw semAcesso();
    const lista = fila
      ? await this.prisma.peca.findMany({ where: { situacao: "Em análise", donoId: { not: null } }, include: this.incluir, orderBy: { id: "asc" } })
      : await this.prisma.peca.findMany({ where: { donoId: quem.id }, include: this.incluir, orderBy: { id: "desc" } });
    return lista.map(this.formatar);
  }

  // Peça de outra pessoa responde como inexistente para quem não aprova consignações.
  private async buscar(id: number, quem: UsuarioDaSessao) {
    const p = await this.prisma.peca.findFirst({ where: { id, donoId: { not: null } }, include: this.incluir });
    if (!p || (p.donoId !== quem.id && !this.aprova(quem))) throw naoEncontrado("Peça em consignação");
    return this.formatar(p);
  }

  async publicar(corpo: unknown, quem: UsuarioDaSessao) {
    const d = validar(corpo, REGRAS);
    // Situação e dono são definidos aqui, nunca pelo formulário: a peça sempre entra em análise, no nome de quem enviou.
    const nova = await this.prisma.peca.create({ data: { marca: "", tamanho: "", ...d, situacao: "Em análise", donoId: quem.id } as any });
    return { ...(await this.buscar(nova.id, quem)), parteDoDono: PARTE_DO_DONO };
  }

  private async emAnalise(id: number, quem: UsuarioDaSessao) {
    const p = await this.buscar(id, quem);
    if (p.situacao !== "Em análise") throw conflito("Esta peça já foi analisada.");
    return p;
  }

  async aprovar(id: number, quem: UsuarioDaSessao) {
    const p = await this.emAnalise(id, quem);
    await this.prisma.peca.update({ where: { id: p.id }, data: { situacao: "Disponível", motivo: "" } });
    return this.buscar(p.id, quem);
  }

  async recusar(id: number, corpo: unknown, quem: UsuarioDaSessao) {
    const p = await this.emAnalise(id, quem);
    const { motivo } = validar(corpo, { motivo: { tipo: "texto", obrigatorio: true, min: 3, max: 200 } });
    await this.prisma.peca.update({ where: { id: p.id }, data: { situacao: "Recusada", motivo } });
    return this.buscar(p.id, quem);
  }

  // Quem enviou pode desistir enquanto a peça não entrou no catálogo.
  async retirar(id: number, quem: UsuarioDaSessao) {
    const p = await this.buscar(id, quem);
    if (p.donoId !== quem.id) throw new ErroHttp(403, "Só quem enviou a peça pode retirá-la.");
    if (!["Em análise", "Recusada"].includes(p.situacao)) throw conflito("Esta peça já está no catálogo. Fale com o brechó para retirá-la.");
    await this.prisma.peca.delete({ where: { id: p.id } });
  }
}

@ApiTags("Consignação")
@ComChaveDeApi()
@Autenticado()
@Controller("api/consignacoes")
export class ConsignacaoController {
  constructor(@Inject(ConsignacaoService) private readonly servico: ConsignacaoService) {}

  @Get()
  @ApiOperation({ summary: "Lista as próprias peças em consignação", description: "Com fila=1, lista as peças esperando análise. Só para quem tem consignacao.aprovar." })
  @ApiQuery({ name: "fila", required: false, enum: ["1"] })
  @ApiResponse({ status: 200, type: [ConsignacaoDto] })
  listar(@Query("fila") fila: string, @Usuario() quem: UsuarioDaSessao) { return this.servico.listar(fila === "1", quem); }

  @Post()
  @Exigir("consignacao.publicar")
  @ApiOperation({ summary: "Envia uma peça para análise" })
  @ApiBody({ type: ConsignacaoEntradaDto })
  @ApiResponse({ status: 201, type: ConsignacaoDto })
  publicar(@Body() corpo: ConsignacaoEntradaDto, @Usuario() quem: UsuarioDaSessao) { return this.servico.publicar(corpo, quem); }

  @Post(":id/aprovar")
  @HttpCode(200)
  @Exigir("consignacao.aprovar")
  @ApiOperation({ summary: "Aprova a peça", description: "A peça entra no catálogo." })
  @ApiResponse({ status: 200, type: ConsignacaoDto })
  @ApiResponse({ status: 409, description: "Peça já analisada." })
  aprovar(@Param("id") id: string, @Usuario() quem: UsuarioDaSessao) { return this.servico.aprovar(lerId(id), quem); }

  @Post(":id/recusar")
  @HttpCode(200)
  @Exigir("consignacao.aprovar")
  @ApiOperation({ summary: "Recusa a peça, com motivo" })
  @ApiBody({ type: RecusaDto })
  @ApiResponse({ status: 200, type: ConsignacaoDto })
  recusar(@Param("id") id: string, @Body() corpo: RecusaDto, @Usuario() quem: UsuarioDaSessao) { return this.servico.recusar(lerId(id), corpo, quem); }

  @Delete(":id")
  @HttpCode(204)
  @Exigir("consignacao.publicar")
  @ApiOperation({ summary: "Retira uma peça que ainda não entrou no catálogo" })
  @ApiResponse({ status: 204 })
  retirar(@Param("id") id: string, @Usuario() quem: UsuarioDaSessao) { return this.servico.retirar(lerId(id), quem); }
}
