// Configuração lida do ambiente, com padrões seguros apenas para desenvolvimento.
export function lerConfig(env = process.env) {
  const producao = env.NODE_ENV === "production";
  const config = {
    porta: Number(env.PORT) || 3333,
    jwtSegredo: env.JWT_SEGREDO || "segredo-de-desenvolvimento",
    apiKey: env.API_KEY || "ciranda-dev-key",
    corsOrigens: (env.CORS_ORIGENS || "http://localhost:5173,http://localhost:4173").split(",").map((o) => o.trim()).filter(Boolean),
    banco: env.BANCO || ":memory:",
    tokenExpiraEm: env.TOKEN_EXPIRA_EM || "30m",
    limitePorMinuto: Number(env.LIMITE_POR_MINUTO) || 120,
    limiteLoginPorMinuto: Number(env.LIMITE_LOGIN_POR_MINUTO) || 10,
    // Atrás de um proxy (Vercel, por exemplo), o IP real do visitante vem no cabeçalho X-Forwarded-For.
    atrasDeProxy: env.ATRAS_DE_PROXY === "1" || !!env.VERCEL,
  };
  // Na Vercel, o próprio endereço do site entra na lista do CORS sem precisar configurar.
  for (const host of [env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_URL]) {
    if (host && !config.corsOrigens.includes(`https://${host}`)) config.corsOrigens.push(`https://${host}`);
  }
  if (producao && (!env.JWT_SEGREDO || !env.API_KEY)) {
    throw new Error("Em produção, defina JWT_SEGREDO e API_KEY no ambiente.");
  }
  return config;
}
