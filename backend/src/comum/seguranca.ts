import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { Config } from "../config.js";
import { ErroHttp } from "./erros.js";

/** Onde a documentação Swagger fica publicada. */
export const ROTA_DA_DOCUMENTACAO = "/api/docs";

// Cabeçalhos de segurança (helmet). A API só devolve JSON, então a CSP nega tudo por padrão.
// A página do Swagger é a única que carrega script e estilo, e só dela mesma e do CDN da interface.
export function cabecalhos(): RequestHandler {
  const comum = { crossOriginResourcePolicy: { policy: "same-site" as const }, referrerPolicy: { policy: "no-referrer" as const } };
  const daApi = helmet({
    ...comum,
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } },
  });
  const daDocumentacao = helmet({
    ...comum,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"], styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        imgSrc: ["'self'", "data:", "https://unpkg.com"], connectSrc: ["'self'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"],
      },
    },
  });
  return (req, res, next) => (req.path.startsWith(ROTA_DA_DOCUMENTACAO) ? daDocumentacao : daApi)(req, res, next);
}

// CORS com lista de origens permitidas. Origem fora da lista é recusada com 403 antes de chegar às rotas,
// o que também barra requisição forjada a partir de outro site (CSRF). Sem Origin (curl, testes), passa.
export function corsRestrito(origensPermitidas: string[]): RequestHandler {
  const METODOS = "GET,POST,PUT,DELETE,OPTIONS";
  const CABECALHOS = "Content-Type,Authorization,X-API-Key";
  return (req, res, next) => {
    const origem = req.get("origin");
    if (!origem) return next();
    if (!origensPermitidas.includes(origem)) return next(new ErroHttp(403, "Origem não permitida pelo CORS."));
    res.setHeader("Access-Control-Allow-Origin", origem);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    if (req.method !== "OPTIONS") return next();
    res.setHeader("Access-Control-Allow-Methods", METODOS);
    res.setHeader("Access-Control-Allow-Headers", CABECALHOS);
    res.setHeader("Access-Control-Max-Age", "600");
    res.status(204).end();
  };
}

// Limite de requisições por IP. O login tem um limite próprio, mais apertado, contra força bruta.
export function limitar(porMinuto: number, mensagem = "Muitas requisições. Tente de novo em instantes."): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: porMinuto,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new ErroHttp(429, mensagem)),
  });
}

// Corpo em JSON com teto de tamanho. Os erros do leitor viram respostas no formato da API.
export function corpoJson(): RequestHandler {
  const ler = express.json({ limit: "100kb" });
  return (req, res, next) => ler(req, res, (erro?: any) => {
    if (!erro) return next();
    if (erro.type === "entity.too.large") return next(new ErroHttp(413, "Corpo da requisição grande demais."));
    next(new ErroHttp(400, "JSON inválido."));
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

function varrer(valor: unknown, profundidade = 0): boolean {
  if (profundidade > 6) return true;
  if (typeof valor === "string") return ASSINATURAS.some((r) => r.test(valor));
  if (Array.isArray(valor)) return valor.some((v) => varrer(v, profundidade + 1));
  if (valor && typeof valor === "object") return Object.entries(valor).some(([k, v]) => varrer(k, profundidade + 1) || varrer(v, profundidade + 1));
  return false;
}

export function filtroDeRequisicoes(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    let caminho = req.originalUrl;
    try { caminho = decodeURIComponent(req.originalUrl); } catch { return next(new ErroHttp(400, "Requisição bloqueada pelo filtro de segurança.")); }
    if (varrer(caminho) || varrer(req.query) || varrer(req.body)) {
      return next(new ErroHttp(400, "Requisição bloqueada pelo filtro de segurança."));
    }
    next();
  };
}

// A ordem importa: cabeçalhos e CORS primeiro, depois limite, corpo, cookies e filtro.
export function aplicarSeguranca(servidor: express.Express, config: Config) {
  servidor.disable("x-powered-by");
  if (config.atrasDeProxy) servidor.set("trust proxy", 1);
  servidor.use(cabecalhos());
  servidor.use(corsRestrito(config.corsOrigens));
  servidor.use(limitar(config.limitePorMinuto));
  servidor.use(corpoJson());
  servidor.use(cookieParser());
  servidor.use(filtroDeRequisicoes());
  // Login, cadastro e renovação de sessão têm o limite apertado.
  const limiteDeAcesso = limitar(config.limiteLoginPorMinuto, "Muitas tentativas de login. Aguarde um minuto.");
  for (const rota of ["/api/auth/login", "/api/auth/cadastro", "/api/auth/renovar"]) servidor.post(rota, limiteDeAcesso);
}
