import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Param, Post, Put } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { UsuarioDaSessao } from "../auth/auth.service.js";
import { PrismaService } from "../banco/prisma.service.js";
import { conflito, invalido, naoEncontrado } from "../comum/erros.js";
import { Autenticado, ComChaveDeApi, Exigir, Usuario } from "../comum/guardas.js";
import { lerId, type Regras, validar } from "../comum/validar.js";

const REGRAS: Regras = {
  nome: { tipo: "texto", obrigatorio: true, min: 3, max: 60 },
  descricao: { tipo: "texto", max: 200 },
  funcionalidades: { tipo: "lista-inteiros", obrigatorio: true },
};

export class PerfilEntradaDto {
  @ApiProperty({ type: String, example: "Curadoria", minLength: 3, maxLength: 60 }) nome!: string;
  @ApiProperty({ type: String, required: false, maxLength: 200 }) descricao?: string;
  @ApiProperty({ type: [Number], example: [1, 2], description: "Identificadores das funcionalidades do perfil." }) funcionalidades!: number[];
}
export class PerfilDto {
  @ApiProperty({ type: Number }) id!: number;
  @ApiProperty({ type: String }) nome!: string;
  @ApiProperty({ type: String }) descricao!: string;
  @ApiProperty({ type: Number, description: "Quantos usuários têm este perfil." }) usuarios!: number;
  @ApiProperty({ type: [Number] }) funcionalidades!: number[];
}

@Injectable()
export class PerfisService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private readonly incluir = { _count: { select: { usuarios: true } }, funcionalidades: { select: { funcionalidadeId: true }, orderBy: { funcionalidadeId: "asc" as const } } };
  private formatar = (p: any) => ({ id: p.id, nome: p.nome, descricao: p.descricao, usuarios: p._count.usuarios, funcionalidades: p.funcionalidades.map((f: any) => f.funcionalidadeId) });

  async listar() {
    return (await this.prisma.perfil.findMany({ include: this.incluir, orderBy: { nome: "asc" } })).map(this.formatar);
  }

  async buscar(id: number) {
    const p = await this.prisma.perfil.findUnique({ where: { id }, include: this.incluir });
    if (!p) throw naoEncontrado("Perfil");
    return this.formatar(p);
  }

  private async conferirFuncionalidades(ids: number[]) {
    const existentes = new Set((await this.prisma.funcionalidade.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((f) => f.id));
    const faltando = ids.filter((id) => !existentes.has(id));
    if (faltando.length) throw invalido({ funcionalidades: `Funcionalidade inexistente: ${faltando.join(", ")}.` });
  }

  async criar(corpo: unknown) {
    const d = validar(corpo, REGRAS);
    if (await this.prisma.perfil.findUnique({ where: { nome: d.nome } })) throw conflito("Já existe um perfil com esse nome.");
    await this.conferirFuncionalidades(d.funcionalidades);
    const novo = await this.prisma.perfil.create({ data: { nome: d.nome, descricao: d.descricao || "", funcionalidades: { create: d.funcionalidades.map((funcionalidadeId: number) => ({ funcionalidadeId })) } } });
    return this.buscar(novo.id);
  }

  async editar(id: number, corpo: unknown, quem: UsuarioDaSessao) {
    const atual = await this.buscar(id);
    const d = validar(corpo, REGRAS);
    const outro = await this.prisma.perfil.findUnique({ where: { nome: d.nome } });
    if (outro && outro.id !== atual.id) throw conflito("Já existe um perfil com esse nome.");
    await this.conferirFuncionalidades(d.funcionalidades);
    // Impede que a pessoa tire de si mesma o acesso à gestão de perfis e fique trancada para fora.
    const gerenciar = await this.prisma.funcionalidade.findUnique({ where: { chave: "perfis.gerenciar" } });
    if (atual.id === quem.perfilId && !d.funcionalidades.includes(gerenciar?.id)) {
      throw conflito("Você não pode remover a gestão de perfis do seu próprio perfil.");
    }
    // Nome e lista de funcionalidades mudam juntos ou não mudam: uma transação só.
    await this.prisma.$transaction([
      this.prisma.perfilFuncionalidade.deleteMany({ where: { perfilId: atual.id } }),
      this.prisma.perfil.update({ where: { id: atual.id }, data: { nome: d.nome, descricao: d.descricao || "", funcionalidades: { create: d.funcionalidades.map((funcionalidadeId: number) => ({ funcionalidadeId })) } } }),
    ]);
    return this.buscar(atual.id);
  }

  async remover(id: number) {
    const atual = await this.buscar(id);
    if (atual.usuarios > 0) throw conflito("Há usuários com este perfil. Troque o perfil deles antes de remover.");
    await this.prisma.perfil.delete({ where: { id: atual.id } });
  }
}

@ApiTags("Perfis")
@ComChaveDeApi()
@Autenticado("perfis.gerenciar")
@Controller("api/perfis")
export class PerfisController {
  constructor(@Inject(PerfisService) private readonly servico: PerfisService) {}

  // Quem gerencia usuários também precisa listar os perfis para escolher um.
  @Get()
  @Exigir("perfis.gerenciar", "usuarios.gerenciar")
  @ApiOperation({ summary: "Lista os perfis" })
  @ApiResponse({ status: 200, type: [PerfilDto] })
  listar() { return this.servico.listar(); }

  @Get(":id")
  @ApiOperation({ summary: "Busca um perfil" })
  @ApiResponse({ status: 200, type: PerfilDto })
  buscar(@Param("id") id: string) { return this.servico.buscar(lerId(id)); }

  @Post()
  @ApiOperation({ summary: "Cria um perfil com as funcionalidades dele" })
  @ApiBody({ type: PerfilEntradaDto })
  @ApiResponse({ status: 201, type: PerfilDto })
  @ApiResponse({ status: 409, description: "Nome já usado." })
  criar(@Body() corpo: PerfilEntradaDto) { return this.servico.criar(corpo); }

  @Put(":id")
  @ApiOperation({ summary: "Edita um perfil" })
  @ApiBody({ type: PerfilEntradaDto })
  @ApiResponse({ status: 200, type: PerfilDto })
  editar(@Param("id") id: string, @Body() corpo: PerfilEntradaDto, @Usuario() quem: UsuarioDaSessao) { return this.servico.editar(lerId(id), corpo, quem); }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove um perfil sem usuários" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 409, description: "Há usuários com este perfil." })
  remover(@Param("id") id: string) { return this.servico.remover(lerId(id)); }
}
