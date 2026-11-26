import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Param, Post, Put } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../banco/prisma.service.js";
import { conflito, naoEncontrado } from "../comum/erros.js";
import { Autenticado, ComChaveDeApi, Exigir } from "../comum/guardas.js";
import { lerId, type Regras, validar } from "../comum/validar.js";

const REGRAS: Regras = {
  chave: { tipo: "texto", obrigatorio: true, min: 3, max: 60, padrao: /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, mensagem: "Use o formato area.acao, em minúsculas." },
  nome: { tipo: "texto", obrigatorio: true, min: 3, max: 80 },
  descricao: { tipo: "texto", max: 200 },
};

export class FuncionalidadeEntradaDto {
  @ApiProperty({ type: String, example: "relatorios.ver", description: "Formato area.acao, em minúsculas." }) chave!: string;
  @ApiProperty({ type: String, example: "Ver relatórios", minLength: 3, maxLength: 80 }) nome!: string;
  @ApiProperty({ type: String, required: false, maxLength: 200 }) descricao?: string;
}
export class FuncionalidadeDto {
  @ApiProperty({ type: Number }) id!: number;
  @ApiProperty({ type: String }) chave!: string;
  @ApiProperty({ type: String }) nome!: string;
  @ApiProperty({ type: String }) descricao!: string;
  @ApiProperty({ type: Number, description: "Quantos perfis usam esta funcionalidade." }) perfis!: number;
}

@Injectable()
export class FuncionalidadesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private readonly incluir = { _count: { select: { perfis: true } } };
  private formatar = (f: any) => ({ id: f.id, chave: f.chave, nome: f.nome, descricao: f.descricao, perfis: f._count.perfis });

  async listar() {
    return (await this.prisma.funcionalidade.findMany({ include: this.incluir, orderBy: { chave: "asc" } })).map(this.formatar);
  }

  async buscar(id: number) {
    const f = await this.prisma.funcionalidade.findUnique({ where: { id }, include: this.incluir });
    if (!f) throw naoEncontrado("Funcionalidade");
    return this.formatar(f);
  }

  async criar(corpo: unknown) {
    const d = validar(corpo, REGRAS);
    if (await this.prisma.funcionalidade.findUnique({ where: { chave: d.chave } })) throw conflito("Já existe uma funcionalidade com essa chave.");
    const nova = await this.prisma.funcionalidade.create({ data: { chave: d.chave, nome: d.nome, descricao: d.descricao || "" } });
    return this.buscar(nova.id);
  }

  async editar(id: number, corpo: unknown) {
    const atual = await this.buscar(id);
    const d = validar(corpo, REGRAS);
    const outra = await this.prisma.funcionalidade.findUnique({ where: { chave: d.chave } });
    if (outra && outra.id !== atual.id) throw conflito("Já existe uma funcionalidade com essa chave.");
    await this.prisma.funcionalidade.update({ where: { id: atual.id }, data: { chave: d.chave, nome: d.nome, descricao: d.descricao || "" } });
    return this.buscar(atual.id);
  }

  async remover(id: number) {
    const atual = await this.buscar(id);
    if (atual.perfis > 0) throw conflito("Esta funcionalidade está em uso por um ou mais perfis. Remova dos perfis antes.");
    await this.prisma.funcionalidade.delete({ where: { id: atual.id } });
  }
}

@ApiTags("Funcionalidades")
@ComChaveDeApi()
@Autenticado("funcionalidades.gerenciar")
@Controller("api/funcionalidades")
export class FuncionalidadesController {
  constructor(@Inject(FuncionalidadesService) private readonly servico: FuncionalidadesService) {}

  // Quem gerencia perfis também precisa listar as funcionalidades para marcá-las.
  @Get()
  @Exigir("funcionalidades.gerenciar", "perfis.gerenciar")
  @ApiOperation({ summary: "Lista as funcionalidades" })
  @ApiResponse({ status: 200, type: [FuncionalidadeDto] })
  listar() { return this.servico.listar(); }

  @Get(":id")
  @ApiOperation({ summary: "Busca uma funcionalidade" })
  @ApiResponse({ status: 200, type: FuncionalidadeDto })
  buscar(@Param("id") id: string) { return this.servico.buscar(lerId(id)); }

  @Post()
  @ApiOperation({ summary: "Cria uma funcionalidade" })
  @ApiBody({ type: FuncionalidadeEntradaDto })
  @ApiResponse({ status: 201, type: FuncionalidadeDto })
  @ApiResponse({ status: 409, description: "Chave já usada." })
  criar(@Body() corpo: FuncionalidadeEntradaDto) { return this.servico.criar(corpo); }

  @Put(":id")
  @ApiOperation({ summary: "Edita uma funcionalidade" })
  @ApiBody({ type: FuncionalidadeEntradaDto })
  @ApiResponse({ status: 200, type: FuncionalidadeDto })
  editar(@Param("id") id: string, @Body() corpo: FuncionalidadeEntradaDto) { return this.servico.editar(lerId(id), corpo); }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove uma funcionalidade que nenhum perfil usa" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 409, description: "Em uso por algum perfil." })
  remover(@Param("id") id: string) { return this.servico.remover(lerId(id)); }
}
