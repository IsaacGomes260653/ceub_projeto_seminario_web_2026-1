import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import { ErroHttp } from "./erros.js";

// Cabeçalhos de segurança. A API só devolve JSON, então a CSP nega tudo por padrão.
export function cabecalhos() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" },
  });
}

// CORS com lista de origens permitidas. Origem fora da lista não recebe os cabeçalhos
// e o navegador bloqueia a resposta. Requisições sem Origin (curl, testes) passam.
export function corsRestrito(origensPermitidas) {
  return cors({
    origin(origem, cb) {
      if (!origem || origensPermitidas.includes(origem)) return cb(null, true);
      return cb(new ErroHttp(403, "Origem não permitida pelo CORS."));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    maxAge: 600,
  });
}

// Chave de API: identifica o cliente autorizado a falar com a API.
// A comparação em tempo constante evita vazar a chave pelo tempo de resposta.
export function exigirChaveDeApi(chaveEsperada) {
  const esperada = Buffer.from(chaveEsperada);
  return (req, _res, next) => {
    const recebida = Buffer.from(String(req.get("x-api-key") || ""));
    const ok = recebida.length === esperada.length && crypto.timingSafeEqual(recebida, esperada);
    if (!ok) return next(new ErroHttp(401, "Chave de API ausente ou inválida."));
    next();
  };
}

// Limite de requisições por IP. O login tem um limite próprio, mais apertado.
export function limitar(porMinuto, mensagem = "Muitas requisições. Tente de novo em instantes.") {
  return rateLimit({
    windowMs: 60_000,
    limit: porMinuto,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new ErroHttp(429, mensagem)),
  });
}

// Filtro de camada 7 (aplicação): recusa requisições com assinaturas comuns de ataque
// antes de chegarem às rotas. É uma linha de defesa a mais dentro da aplicação.
// Em produção ele trabalha junto com um WAF de borda, não no lugar dele.
const ASSINATURAS = [
  /<\s*script\b/i,                      // XSS
  /\bon(?:error|load|click)\s*=/i,       // XSS por atributo de evento
  /javascript\s*:/i,
  /\bunion\b[\s\S]{0,40}\bselect\b/i,    // injeção de SQL
  /;\s*(?:drop|truncate|alter)\s+table\b/i,
  /(?:'|")\s*or\s+(?:'|")?\d+(?:'|")?\s*=\s*(?:'|")?\d+/i,
  /\.\.[\\/]/,                           // travessia de diretório
  /\x00/,                                // byte nulo
];

function varrer(valor, profundidade = 0) {
  if (profundidade > 6) return true;
  if (typeof valor === "string") return ASSINATURAS.some((r) => r.test(valor));
  if (Array.isArray(valor)) return valor.some((v) => varrer(v, profundidade + 1));
  if (valor && typeof valor === "object") return Object.entries(valor).some(([k, v]) => varrer(k, profundidade + 1) || varrer(v, profundidade + 1));
  return false;
}

export function filtroDeRequisicoes() {
  return (req, _res, next) => {
    let caminho = req.originalUrl;
    try { caminho = decodeURIComponent(req.originalUrl); } catch { return next(new ErroHttp(400, "Requisição bloqueada pelo filtro de segurança.")); }
    if (varrer(caminho) || varrer(req.query) || varrer(req.body)) {
      return next(new ErroHttp(400, "Requisição bloqueada pelo filtro de segurança."));
    }
    next();
  };
}
