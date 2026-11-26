// Ponto de entrada na Vercel. A plataforma espera um app Express exportado.
// O app daqui só repassa cada requisição para a aplicação NestJS, montada na primeira chamada.
// pacote/api.mjs é a aplicação inteira em um arquivo só, gerado por "npm run build:vercel".
import express from "express";

const app = express();
let pronto;
app.use(async (req, res, next) => {
  try {
    pronto ||= import("./pacote/api.mjs").then((m) => m.criar());
    (await pronto)(req, res, next);
  } catch (erro) {
    pronto = undefined;
    next(erro);
  }
});

export default app;
