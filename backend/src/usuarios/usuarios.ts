import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Param, Post, Put } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import bcrypt from "bcryptjs";
import type { UsuarioDaSessao } from "../auth/auth.service.js";
import { PrismaService } from "../banco/prisma.service.js";
import { conflito, invalido, naoEncontrado } from "../comum/erros.js";
import { Autenticado, ComChaveDeApi, Usuario } from "../comum/guardas.js";
import { lerId, type Regras, validar } from "../comum/validar.js";
import { CONFIG, type Config } from "../config.js";

const REGRAS: Regras = {
  nome: { tipo: "texto", obrigatorio: true, min: 3, max: 80 },
  email: { tipo: "email", obrigatorio: true, max: 120 },
  perfilId: { tipo: "inteiro", obrigatorio: true, min: 1 },
  ativo: { tipo: "booleano" },
};
const SENHA = { tipo: "texto", min: 8, max: 200 } as const;

export class UsuarioEntradaDto {
  @ApiProperty({ type: String, example: "Marina Lopes", minLength: 3, maxLength: 80 }) nome!: string;
  @ApiProperty({ type: String, example: "marina@ciranda.app", maxLength: 120 }) email!: string;
  @ApiProperty({ type: Number, example: 2, description: "Identificador do perfil." }) perfilId!: number;
  @ApiProperty({ type: Boolean, required: false, default: true }) ativo?: boolean;
  @ApiProperty({ type: String, required: false, minLength: 8, description: "Obrigatória ao criar. Ao editar, só mande para trocar." }) senha?: string;
}
export class UsuarioDto {
  @ApiProperty({ type: Number }) id!: number;
  @ApiProperty({ type: String }) nome!: string;
  @ApiProperty({ type: String }) email!: string;
  @ApiProperty({ type: Number }) perfilId!: number;
  @ApiProperty({ type: String, example: "Fornecedor" }) perfil!: string;
  @ApiProperty({ type: Boolean }) ativo!: boolean;
  @ApiProperty({ type: String, format: "date-time" }) criadoEm!: Date;
}

@Injectable()
export class UsuariosService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(CONFIG) private readonly config: Config) {}

  // A senha nunca sai da API: o select lista os campos devolvidos e o hash não está entre eles.
  private readonly campos = { id: true, nome: true, email: true, perfilId: true, ativo: true, criadoEm: true, perfil: { select: { nome: true } } } as const;
  private formatar = (u: { perfil: { nome: string } } & Record<string, any>) => ({ id: u.id, nome: u.nome, email: u.email, perfilId: u.perfilId, perfil: u.perfil.nome, ativo: u.ativo, criadoEm: u.criadoEm });
  private hash = (senha: string) => bcrypt.hashSync(senha, this.config.custoDoHash);

  async listar() {
    return (await this.prisma.usuario.findMany({ select: this.campos, orderBy: { nome: "asc" } })).map(this.formatar);
  }

  async buscar(id: number) {
    const u = await this.prisma.usuario.findUnique({ where: { id }, select: this.campos });
    if (!u) throw naoEncontrado("Usuário");
    return this.formatar(u);
  }

  private async conferirPerfil(id: number) {
    if (!(await this.prisma.perfil.findUnique({ where: { id } }))) throw invalido({ perfilId: "Perfil inexistente." });
  }

  async criar(corpo: unknown) {
    const d = validar(corpo, { ...REGRAS, senha: { ...SENHA, obrigatorio: true } });
    if (await this.prisma.usuario.findUnique({ where: { email: d.email } })) throw conflito("Já existe um usuário com esse e-mail.");
    await this.conferirPerfil(d.perfilId);
    const novo = await this.prisma.usuario.create({ data: { nome: d.nome, email: d.email, senhaHash: this.hash(d.senha), perfilId: d.perfilId, ativo: d.ativo !== false } });
    return this.buscar(novo.id);
  }

  async editar(id: number, corpo: unknown, quem: UsuarioDaSessao) {
    const atual = await this.buscar(id);
    const d = validar(corpo, { ...REGRAS, senha: SENHA });
    const outro = await this.prisma.usuario.findUnique({ where: { email: d.email } });
    if (outro && outro.id !== atual.id) throw conflito("Já existe um usuário com esse e-mail.");
    await this.conferirPerfil(d.perfilId);
    const ativo = d.ativo === undefined ? atual.ativo : d.ativo;
    if (atual.id === quem.id && (!ativo || d.perfilId !== atual.perfilId)) {
      throw conflito("Você não pode desativar a própria conta nem trocar o próprio perfil.");
    }
    await this.prisma.usuario.update({ where: { id: atual.id }, data: { nome: d.nome, email: d.email, perfilId: d.perfilId, ativo, ...(d.senha ? { senhaHash: this.hash(d.senha) } : {}) } });
    // Conta desativada ou com senha nova perde as sessões abertas.
    if (!ativo || d.senha) await this.prisma.sessao.deleteMany({ where: { usuarioId: atual.id } });
    return this.buscar(atual.id);
  }

  async remover(id: number, quem: UsuarioDaSessao) {
    const atual = await this.buscar(id);
    if (atual.id === quem.id) throw conflito("Você não pode remover a própria conta.");
    await this.prisma.usuario.delete({ where: { id: atual.id } });
  }
}

@ApiTags("Usuários")
@ComChaveDeApi()
@Autenticado("usuarios.gerenciar")
@Controller("api/usuarios")
export class UsuariosController {
  constructor(@Inject(UsuariosService) private readonly servico: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: "Lista os usuários" })
  @ApiResponse({ status: 200, type: [UsuarioDto] })
  listar() { return this.servico.listar(); }

  @Get(":id")
  @ApiOperation({ summary: "Busca um usuário" })
  @ApiResponse({ status: 200, type: UsuarioDto })
  @ApiResponse({ status: 404, description: "Usuário não encontrado." })
  buscar(@Param("id") id: string) { return this.servico.buscar(lerId(id)); }

  @Post()
  @ApiOperation({ summary: "Cria um usuário" })
  @ApiBody({ type: UsuarioEntradaDto })
  @ApiResponse({ status: 201, type: UsuarioDto })
  @ApiResponse({ status: 400, description: "Campos inválidos." })
  @ApiResponse({ status: 409, description: "E-mail já usado." })
  criar(@Body() corpo: UsuarioEntradaDto) { return this.servico.criar(corpo); }

  @Put(":id")
  @ApiOperation({ summary: "Edita um usuário" })
  @ApiBody({ type: UsuarioEntradaDto })
  @ApiResponse({ status: 200, type: UsuarioDto })
  @ApiResponse({ status: 409, description: "E-mail já usado, ou tentativa de desativar a própria conta." })
  editar(@Param("id") id: string, @Body() corpo: UsuarioEntradaDto, @Usuario() quem: UsuarioDaSessao) { return this.servico.editar(lerId(id), corpo, quem); }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove um usuário" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 409, description: "Ninguém remove a própria conta." })
  remover(@Param("id") id: string, @Usuario() quem: UsuarioDaSessao) { return this.servico.remover(lerId(id), quem); }
}
