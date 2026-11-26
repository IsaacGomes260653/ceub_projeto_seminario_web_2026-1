import { invalido } from "./erros.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface Regra {
  tipo: "texto" | "email" | "numero" | "inteiro" | "booleano" | "lista-inteiros";
  obrigatorio?: boolean;
  min?: number;
  max?: number;
  opcoes?: readonly string[];
  padrao?: RegExp;
  mensagem?: string;
}
export type Regras = Record<string, Regra>;

// Validação de entrada: confere cada campo contra a regra e devolve só os campos conhecidos (lista de permissão).
// Campo que a regra não cita é descartado, então ninguém grava "perfilId" ou "ativo" onde não devia.
// Os erros voltam por campo, em português, para a tela apontar onde corrigir.
export function validar<T = Record<string, any>>(dados: unknown, regras: Regras): T {
  const erros: Record<string, string> = {};
  const limpo: Record<string, unknown> = {};
  const entrada = (dados && typeof dados === "object" ? dados : {}) as Record<string, unknown>;
  for (const [campo, r] of Object.entries(regras)) {
    let v = entrada[campo];
    const ausente = v === undefined || v === null || v === "";
    if (ausente) {
      if (r.obrigatorio) erros[campo] = "Campo obrigatório.";
      continue;
    }
    if (r.tipo === "texto" || r.tipo === "email") {
      if (typeof v !== "string") { erros[campo] = "Deve ser texto."; continue; }
      v = v.trim();
      const texto = v as string;
      if (r.min && texto.length < r.min) { erros[campo] = `Mínimo de ${r.min} caracteres.`; continue; }
      if (r.max && texto.length > r.max) { erros[campo] = `Máximo de ${r.max} caracteres.`; continue; }
      if (r.tipo === "email" && !EMAIL.test(texto)) { erros[campo] = "E-mail inválido."; continue; }
      if (r.opcoes && !r.opcoes.includes(texto)) { erros[campo] = "Valor não permitido."; continue; }
      if (r.padrao && !r.padrao.test(texto)) { erros[campo] = r.mensagem || "Formato inválido."; continue; }
      limpo[campo] = r.tipo === "email" ? texto.toLowerCase() : texto;
    } else if (r.tipo === "numero" || r.tipo === "inteiro") {
      const n = Number(v);
      if (!Number.isFinite(n) || (r.tipo === "inteiro" && !Number.isInteger(n))) { erros[campo] = "Número inválido."; continue; }
      if (r.min !== undefined && n < r.min) { erros[campo] = `Mínimo ${r.min}.`; continue; }
      if (r.max !== undefined && n > r.max) { erros[campo] = `Máximo ${r.max}.`; continue; }
      limpo[campo] = n;
    } else if (r.tipo === "booleano") {
      if (typeof v !== "boolean") { erros[campo] = "Deve ser verdadeiro ou falso."; continue; }
      limpo[campo] = v;
    } else {
      if (!Array.isArray(v) || v.some((x) => !Number.isInteger(x))) { erros[campo] = "Deve ser uma lista de identificadores."; continue; }
      limpo[campo] = [...new Set(v as number[])];
    }
  }
  if (Object.keys(erros).length) throw invalido(erros);
  return limpo as T;
}

/** Identificador de rota: só inteiro positivo. Qualquer outra coisa é recusada antes de chegar ao banco. */
export function lerId(valor: unknown): number {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw invalido({ id: "Identificador inválido." });
  return id;
}
