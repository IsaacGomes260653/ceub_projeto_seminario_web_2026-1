import { invalido } from "./erros.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Valida um objeto contra regras simples e devolve só os campos conhecidos.
// regras: { campo: { tipo, obrigatorio, min, max, opcoes } }
export function validar(dados, regras, { parcial = false } = {}) {
  const erros = {};
  const limpo = {};
  const entrada = dados && typeof dados === "object" ? dados : {};
  for (const [campo, r] of Object.entries(regras)) {
    let v = entrada[campo];
    const ausente = v === undefined || v === null || v === "";
    if (ausente) {
      if (r.obrigatorio && !parcial) erros[campo] = "Campo obrigatório.";
      continue;
    }
    if (r.tipo === "texto" || r.tipo === "email") {
      if (typeof v !== "string") { erros[campo] = "Deve ser texto."; continue; }
      v = v.trim();
      if (r.min && v.length < r.min) { erros[campo] = `Mínimo de ${r.min} caracteres.`; continue; }
      if (r.max && v.length > r.max) { erros[campo] = `Máximo de ${r.max} caracteres.`; continue; }
      if (r.tipo === "email" && !EMAIL.test(v)) { erros[campo] = "E-mail inválido."; continue; }
      if (r.opcoes && !r.opcoes.includes(v)) { erros[campo] = "Valor não permitido."; continue; }
      if (r.padrao && !r.padrao.test(v)) { erros[campo] = r.mensagem || "Formato inválido."; continue; }
      limpo[campo] = r.tipo === "email" ? v.toLowerCase() : v;
    } else if (r.tipo === "numero" || r.tipo === "inteiro") {
      const n = Number(v);
      if (!Number.isFinite(n) || (r.tipo === "inteiro" && !Number.isInteger(n))) { erros[campo] = "Número inválido."; continue; }
      if (r.min !== undefined && n < r.min) { erros[campo] = `Mínimo ${r.min}.`; continue; }
      if (r.max !== undefined && n > r.max) { erros[campo] = `Máximo ${r.max}.`; continue; }
      limpo[campo] = n;
    } else if (r.tipo === "booleano") {
      if (typeof v !== "boolean") { erros[campo] = "Deve ser verdadeiro ou falso."; continue; }
      limpo[campo] = v;
    } else if (r.tipo === "lista-inteiros") {
      if (!Array.isArray(v) || v.some((x) => !Number.isInteger(x))) { erros[campo] = "Deve ser uma lista de identificadores."; continue; }
      limpo[campo] = [...new Set(v)];
    }
  }
  if (Object.keys(erros).length) throw invalido(erros);
  return limpo;
}

export function lerId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw invalido({ id: "Identificador inválido." });
  return id;
}
