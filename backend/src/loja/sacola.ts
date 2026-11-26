import { Body, Controller, Delete, Get, Inject, Injectable, Param, Post, UseInterceptors } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { UsuarioDaSessao } from "../auth/auth.service.js";
import { PrismaService } from "../banco/prisma.service.js";
import { conflito, naoEncontrado } from "../comum/erros.js";
import { Autenticado, ComChaveDeApi, Usuario } from "../comum/guardas.js";
import { lerId, validar } from "../comum/validar.js";
import { CONFIG, type Config } from "../config.js";
import { FORA_DO_CATALOGO } from "../pecas/pecas.js";
import { centavos, EmDia, PRAZO_MS } from "./reservas.js";

export class SacolaEntradaDto {
  @ApiProperty({ type: Number, example: 4, description: "Identificador da peça." }) pecaId!: number;
}
export class SacolaItemDto {
  @ApiProperty({ type: Number }) id!: number;
  @ApiProperty({ type: String }) titulo!: string;
  @ApiProperty({ type: String }) marca!: string;
  @ApiProperty({ type: String }) tamanho!: string;
  @ApiProperty({ type: String }) categoria!: string;
  @ApiProperty({ type: Number }) preco!: number;
  @ApiProperty({ type: String }) foto!: string;
  @ApiProperty({ type: Number, description: "Até quando a peça fica reservada, em milissegundos." }) reservadaAte!: number;
}
export class SacolaDto {
  @ApiProperty({ type: [SacolaItemDto] }) itens!: SacolaItemDto[];
  @ApiProperty({ type: Number, example: 129.9 }) total!: number;
}

// Sacola: colocar uma peça nela reserva a peça por 30 minutos para aquela pessoa.
@Injectable()
export class SacolaService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(CONFIG) private readonly config: Config) {}

  async ver(usuarioId: number) {
    const linhas = await this.prisma.sacolaItem.findMany({ where: { usuarioId }, include: { peca: true }, orderBy: [{ reservadaAte: "asc" }, { pecaId: "asc" }] });
    const itens = linhas.map(({ peca: p, reservadaAte }) => ({ id: p.id, titulo: p.titulo, marca: p.marca, tamanho: p.tamanho, categoria: p.categoria, preco: p.preco, foto: p.foto, reservadaAte: reservadaAte.getTime() }));
    return { itens, total: centavos(itens.reduce((t, i) => t + i.preco, 0)) };
  }

  async colocar(corpo: unknown, quem: UsuarioDaSessao) {
    const { pecaId } = validar(corpo, { pecaId: { tipo: "inteiro", obrigatorio: true, min: 1 } });
    await this.prisma.$transaction(async (tx) => {
      const p = await tx.peca.findUnique({ where: { id: pecaId } });
      if (!p || FORA_DO_CATALOGO.includes(p.situacao)) throw naoEncontrado("Peça");
      if (await tx.sacolaItem.findFirst({ where: { pecaId, usuarioId: quem.id } })) return;
      if (p.donoId === quem.id) throw conflito("Esta peça é sua. Ela não pode ir para a sua sacola.");
      // A troca de situação só acontece se a peça ainda estiver disponível neste instante.
      // Se duas pessoas tentarem juntas, o banco deixa uma só passar.
      const { count } = await tx.peca.updateMany({ where: { id: pecaId, situacao: "Disponível" }, data: { situacao: "Reservada" } });
      if (!count) throw conflito(p.situacao === "Vendida" ? "Esta peça já foi vendida." : "Esta peça acabou de ser reservada por outra pessoa.");
      await tx.sacolaItem.create({ data: { pecaId, usuarioId: quem.id, reservadaAte: new Date(this.config.agora() + PRAZO_MS) } });
    });
    return this.ver(quem.id);
  }

  async tirar(pecaId: number, quem: UsuarioDaSessao) {
    // O filtro por usuário impede que alguém mexa na sacola de outra pessoa trocando o número na rota.
    if (!(await this.prisma.sacolaItem.findFirst({ where: { pecaId, usuarioId: quem.id } }))) throw naoEncontrado("Item da sacola");
    await this.prisma.$transaction([
      this.prisma.sacolaItem.delete({ where: { pecaId } }),
      this.prisma.peca.updateMany({ where: { id: pecaId, situacao: "Reservada" }, data: { situacao: "Disponível" } }),
    ]);
    return this.ver(quem.id);
  }
}

@ApiTags("Sacola")
@ComChaveDeApi()
@Autenticado("sacola.usar")
@UseInterceptors(EmDia)
@Controller("api/sacola")
export class SacolaController {
  constructor(@Inject(SacolaService) private readonly servico: SacolaService) {}

  @Get()
  @ApiOperation({ summary: "Vê a própria sacola" })
  @ApiResponse({ status: 200, type: SacolaDto })
  ver(@Usuario() quem: UsuarioDaSessao) { return this.servico.ver(quem.id); }

  @Post()
  @ApiOperation({ summary: "Coloca uma peça na sacola", description: "Reserva a peça por 30 minutos." })
  @ApiBody({ type: SacolaEntradaDto })
  @ApiResponse({ status: 201, type: SacolaDto })
  @ApiResponse({ status: 409, description: "Peça vendida, reservada por outra pessoa ou da própria pessoa." })
  colocar(@Body() corpo: SacolaEntradaDto, @Usuario() quem: UsuarioDaSessao) { return this.servico.colocar(corpo, quem); }

  @Delete(":pecaId")
  @ApiOperation({ summary: "Tira uma peça da sacola", description: "A peça volta ao catálogo." })
  @ApiResponse({ status: 200, type: SacolaDto })
  tirar(@Param("pecaId") pecaId: string, @Usuario() quem: UsuarioDaSessao) { return this.servico.tirar(lerId(pecaId), quem); }
}
