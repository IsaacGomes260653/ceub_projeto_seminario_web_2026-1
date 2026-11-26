import bcrypt from "bcryptjs";
import type { PrismaClient } from "./cliente/client.js";

export const FUNCIONALIDADES_BASE: [string, string, string][] = [
  ["catalogo.ver", "Ver o catálogo", "Navegar pelas peças disponíveis."],
  ["pecas.gerenciar", "Gerenciar peças", "Cadastrar, editar e remover peças do brechó."],
  ["usuarios.gerenciar", "Gerenciar usuários", "Cadastrar, editar e remover usuários."],
  ["perfis.gerenciar", "Gerenciar perfis", "Definir perfis e o que cada um pode fazer."],
  ["funcionalidades.gerenciar", "Gerenciar funcionalidades", "Manter o cadastro de funcionalidades do sistema."],
  ["sacola.usar", "Comprar", "Reservar peças na sacola, pagar e acompanhar os próprios pedidos."],
  ["consignacao.publicar", "Vender em consignação", "Enviar peças próprias para análise e acompanhar o repasse."],
  ["consignacao.aprovar", "Aprovar consignação", "Aprovar ou recusar peças enviadas para o brechó."],
  ["bastidores.ver", "Ver os bastidores", "Acompanhar vendas, repasses e o andamento dos pedidos."],
];

const PERFIS_BASE: [string, string, string[]][] = [
  ["Administradora", "Acesso completo ao sistema.", FUNCIONALIDADES_BASE.map((f) => f[0])],
  ["Fornecedor", "Mantém o acervo e vende as próprias peças.", ["catalogo.ver", "pecas.gerenciar", "sacola.usar", "consignacao.publicar"]],
  ["Cliente", "Compra no catálogo e pode vender em consignação.", ["catalogo.ver", "sacola.usar", "consignacao.publicar"]],
];

const USUARIOS_BASE: [string, string, string][] = [
  ["Lúcia Andrade", "lucia@ciranda.app", "Administradora"],
  ["Beatriz Ribeiro", "beatriz@ciranda.app", "Fornecedor"],
  ["Ana Costa", "ana@ciranda.app", "Cliente"],
];

const PECAS_BASE: [string, string, string, string, string, number, number, string][] = [
  ["Camiseta listrada de algodão", "Hering", "M", "Camisetas e blusas", "Ótimo estado", 39.9, 2, "camiseta-listrada.webp"],
  ["Calça jeans reta lavagem média", "Levi's", "40", "Calças jeans", "Bom estado", 119.9, 3, "calca-jeans.webp"],
  ["Vestido midi floral", "Farm", "P", "Vestidos", "Ótimo estado", 149.0, 1, "vestido-floral.webp"],
  ["Jaqueta jeans oversized", "Zara", "G", "Jaquetas e casacos", "Bom estado", 129.9, 2, "jaqueta-jeans.webp"],
  ["Camisa de linho manga longa", "Reserva", "M", "Camisas", "Novo com etiqueta", 89.9, 1, "camisa-linho.webp"],
  ["Camiseta básica orgânica", "Insecta", "G", "Camisetas e blusas", "Ótimo estado", 24.9, 1, "camiseta-verde.webp"],
  ["Moletom Clube da Roda", "Redley", "G", "Camisetas e blusas", "Bom estado", 79.9, 3, "moletom-clube.webp"],
  ["Tênis de lona branco", "Vert", "38", "Calçados", "Bom estado", 99.9, 2, "tenis-lona.webp"],
  ["Camiseta branca de bolso", "Osklen", "M", "Camisetas e blusas", "Ótimo estado", 59.9, 1, "camiseta-bolso.webp"],
  ["Camisa estampada de viscose", "Foxton", "M", "Camisas", "Ótimo estado", 84.9, 2, "camisa-estampada.webp"],
  ["Blusa de tricô canelado", "Renner", "P", "Camisetas e blusas", "Ótimo estado", 54.9, 4, "trico-caramelo.webp"],
  ["Camiseta Flor de Maio", "Farm", "M", "Camisetas e blusas", "Bom estado", 44.9, 2, "camiseta-flor.webp"],
  ["Camiseta preta lisa", "Basico.com", "P", "Camisetas e blusas", "Ótimo estado", 29.9, 1, "camiseta-preta.webp"],
];

/** Senha das três contas de demonstração. É pública de propósito: os dados são fictícios. */
export const SENHA_DEMO = "ciranda123";

// Dados de demonstração: funcionalidades, três perfis, uma conta de cada e as peças do catálogo.
export async function semear(prisma: PrismaClient, custoDoHash: number) {
  const senhaHash = bcrypt.hashSync(SENHA_DEMO, custoDoHash);
  await prisma.$transaction(async (tx) => {
    await tx.funcionalidade.createMany({ data: FUNCIONALIDADES_BASE.map(([chave, nome, descricao]) => ({ chave, nome, descricao })) });
    const idF = Object.fromEntries((await tx.funcionalidade.findMany()).map((f) => [f.chave, f.id]));
    const idP: Record<string, number> = {};
    for (const [nome, descricao, chaves] of PERFIS_BASE) {
      const perfil = await tx.perfil.create({ data: { nome, descricao, funcionalidades: { create: chaves.map((c) => ({ funcionalidadeId: idF[c] })) } } });
      idP[nome] = perfil.id;
    }
    for (const [nome, email, perfil] of USUARIOS_BASE) await tx.usuario.create({ data: { nome, email, senhaHash, perfilId: idP[perfil] } });
    // Uma a uma, para os identificadores seguirem a ordem da lista.
    for (const [titulo, marca, tamanho, categoria, conservacao, preco, voltas, foto] of PECAS_BASE) {
      await tx.peca.create({ data: { titulo, marca, tamanho, categoria, conservacao, preco, voltas, foto } });
    }
    // Consignação de demonstração: duas peças já aprovadas da Beatriz e uma esperando análise.
    const bia = await tx.usuario.findUniqueOrThrow({ where: { email: "beatriz@ciranda.app" } });
    await tx.peca.updateMany({ where: { foto: { in: ["jaqueta-jeans.webp", "camisa-linho.webp"] } }, data: { donoId: bia.id } });
    await tx.peca.create({ data: { titulo: "Saia midi plissada", marca: "Amaro", tamanho: "M", categoria: "Saias", conservacao: "Ótimo estado", preco: 69.9, voltas: 1, situacao: "Em análise", donoId: bia.id } });
  });
}
