import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiProperty, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { UsuarioDaSessao } from "../auth/auth.service.js";
import { PrismaService } from "../banco/prisma.service.js";
import { naoEncontrado } from "../comum/erros.js";
import { Autenticado, ComChaveDeApi, Exigir, Usuario } from "../comum/guardas.js";
import { lerId, type Regras, validar } from "../comum/validar.js";
import { EmDia } from "../loja/reservas.js";

export const CATEGORIAS = ["Camisetas e blusas", "Camisas", "Vestidos", "Saias", "Calças jeans", "Jaquetas e casacos", "Calçados", "Bolsas e acessórios"];
export const CONSERVACOES = ["Novo com etiqueta", "Ótimo estado", "Bom estado", "Com marcas de uso"];
export const SITUACOES = ["Disponível", "Reservada", "Vendida", "Em análise", "Recusada"];
// Peça em consignação que ainda não foi aprovada só aparece para quem gerencia o acervo.
export const FORA_DO_CATALOGO = ["Em análise", "Recusada"];

const REGRAS: Regras = {
  titulo: { tipo: "texto", obrigatorio: true, min: 3, max: 80 },
  marca: { tipo: "texto", max: 40 },
  tamanho: { tipo: "texto", max: 10 },
  categoria: { tipo: "texto", obrigatorio: true, opcoes: CATEGORIAS },
  conservacao: { tipo: "texto", obrigatorio: true, opcoes: CONSERVACOES },
  preco: { tipo: "numero", obrigatorio: true, min: 0.01, max: 100000 },
  voltas: { tipo: "inteiro", min: 1, max: 99 },
  foto: { tipo: "texto", max: 120, padrao: /^[a-z0-9-]+\.(webp|png|jpg)$/, mensagem: "Informe só o nome do arquivo da foto." },
  situacao: { tipo: "texto", opcoes: SITUACOES },
};

export class PecaEntradaDto {
  @ApiProperty({ type: String, example: "Jaqueta jeans oversized", minLength: 3, maxLength: 80 }) titulo!: string;
  @ApiProperty({ type: String, required: false, example: "Zara", maxLength: 40 }) marca?: string;
  @ApiProperty({ type: String, required: false, example: "G", maxLength: 10 }) tamanho?: string;
  @ApiProperty({ type: String, enum: CATEGORIAS }) categoria!: string;
  @ApiProperty({ type: String, enum: CONSERVACOES }) conservacao!: string;
  @ApiProperty({ type: Number, example: 129.9, minimum: 0.01 }) preco!: number;
  @ApiProperty({ type: Number, required: false, example: 2, minimum: 1, maximum: 99 }) voltas?: number;
  @ApiProperty({ type: String, required: false, example: "jaqueta-jeans.webp", description: "Só o nome do arquivo." }) foto?: string;
  @ApiProperty({ type: String, required: false, enum: SITUACOES }) situacao?: string;
}
export class PecaDto extends PecaEntradaDto {
  @ApiProperty({ type: Number }) id!: number;
  @ApiProperty({ type: Number, nullable: true, description: "Quem deixou a peça em consignação." }) donoId!: number | null;
  @ApiProperty({ type: String, description: "Motivo da recusa, quando houver." }) motivo!: string;
}

@Injectable()
export class PecasService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private gerencia = (quem: UsuarioDaSessao) => quem.funcionalidades.includes("pecas.gerenciar");

  // Busca pelo cliente do Prisma: o texto digitado vira parâmetro da consulta, nunca um pedaço do SQL.
  async listar(consulta: unknown, quem: UsuarioDaSessao) {
    const f = validar(consulta, { q: { tipo: "texto", max: 60 }, categoria: { tipo: "texto", opcoes: CATEGORIAS }, situacao: { tipo: "texto", opcoes: SITUACOES } });
    return this.prisma.peca.findMany({
      where: {
        ...(f.q ? { OR: [{ titulo: { contains: f.q } }, { marca: { contains: f.q } }] } : {}),
        ...(f.categoria ? { categoria: f.categoria } : {}),
        AND: [f.situacao ? { situacao: f.situacao } : {}, this.gerencia(quem) ? {} : { situacao: { notIn: FORA_DO_CATALOGO } }],
      },
      orderBy: { id: "desc" },
    });
  }

  private async achar(id: number) {
    const p = await this.prisma.peca.findUnique({ where: { id } });
    if (!p) throw naoEncontrado("Peça");
    return p;
  }

  async buscar(id: number, quem: UsuarioDaSessao) {
    const p = await this.achar(id);
    if (FORA_DO_CATALOGO.includes(p.situacao) && !this.gerencia(quem)) throw naoEncontrado("Peça");
    return p;
  }

  async criar(corpo: unknown) {
    const d = validar(corpo, REGRAS);
    return this.prisma.peca.create({ data: { marca: "", tamanho: "", voltas: 1, foto: "", situacao: "Disponível", ...d } as any });
  }

  async editar(id: number, corpo: unknown) {
    const atual = await this.achar(id);
    const d = validar(corpo, REGRAS);
    return this.prisma.peca.update({ where: { id: atual.id }, data: { marca: "", tamanho: "", ...d } });
  }

  async remover(id: number) {
    const atual = await this.achar(id);
    await this.prisma.peca.delete({ where: { id: atual.id } });
  }
}

@ApiTags("Peças")
@ComChaveDeApi()
@Autenticado("pecas.gerenciar")
@UseInterceptors(EmDia)
@Controller("api/pecas")
export class PecasController {
  constructor(@Inject(PecasService) private readonly servico: PecasService) {}

  @Get()
  @Exigir("catalogo.ver")
  @ApiOperation({ summary: "Lista o catálogo", description: "Quem não gerencia o acervo não vê peça em análise nem recusada." })
  @ApiQuery({ name: "q", required: false, description: "Busca em título e marca." })
  @ApiQuery({ name: "categoria", required: false, enum: CATEGORIAS })
  @ApiQuery({ name: "situacao", required: false, enum: SITUACOES })
  @ApiResponse({ status: 200, type: [PecaDto] })
  listar(@Query() consulta: Record<string, unknown>, @Usuario() quem: UsuarioDaSessao) { return this.servico.listar(consulta, quem); }

  @Get(":id")
  @Exigir("catalogo.ver")
  @ApiOperation({ summary: "Busca uma peça" })
  @ApiResponse({ status: 200, type: PecaDto })
  @ApiResponse({ status: 404, description: "Peça não encontrada." })
  buscar(@Param("id") id: string, @Usuario() quem: UsuarioDaSessao) { return this.servico.buscar(lerId(id), quem); }

  @Post()
  @ApiOperation({ summary: "Cadastra uma peça no acervo" })
  @ApiBody({ type: PecaEntradaDto })
  @ApiResponse({ status: 201, type: PecaDto })
  criar(@Body() corpo: PecaEntradaDto) { return this.servico.criar(corpo); }

  @Put(":id")
  @ApiOperation({ summary: "Edita uma peça" })
  @ApiBody({ type: PecaEntradaDto })
  @ApiResponse({ status: 200, type: PecaDto })
  editar(@Param("id") id: string, @Body() corpo: PecaEntradaDto) { return this.servico.editar(lerId(id), corpo); }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove uma peça" })
  @ApiResponse({ status: 204 })
  remover(@Param("id") id: string) { return this.servico.remover(lerId(id)); }
}
