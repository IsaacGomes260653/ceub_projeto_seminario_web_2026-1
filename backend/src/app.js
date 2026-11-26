import express from "express";
import { criarAuth } from "./auth.js";
import { ErroHttp } from "./erros.js";
import { cabecalhos, corsRestrito, exigirChaveDeApi, filtroDeRequisicoes, limitar } from "./seguranca.js";
import { criarReservas } from "./reservas.js";
import { rotasAuth } from "./rotas/auth.js";
import { rotasConsignacao } from "./rotas/consignacao.js";
import { rotasPainel } from "./rotas/painel.js";
import { rotasPedidos } from "./rotas/pedidos.js";
import { rotasSacola } from "./rotas/sacola.js";
import { rotasFuncionalidades } from "./rotas/funcionalidades.js";
import { rotasPerfis } from "./rotas/perfis.js";
import { rotasPecas } from "./rotas/pecas.js";
import { rotasUsuarios } from "./rotas/usuarios.js";

// Monta a aplicação. Recebe banco e configuração para os testes poderem trocar os dois.
export function criarApp(db, config) {
  const app = express();
  const auth = criarAuth(db, config);
  const reservas = criarReservas(db, config);
  app.disable("x-powered-by");
  if (config.atrasDeProxy) app.set("trust proxy", 1);

  // A ordem importa: cabeçalhos e CORS primeiro, depois limite, corpo, filtro e chave.
  app.use(cabecalhos());
  app.use(corsRestrito(config.corsOrigens));
  app.use(limitar(config.limitePorMinuto));
  app.use(express.json({ limit: "100kb" }));
  app.use(filtroDeRequisicoes());

  app.get("/api/saude", (_req, res) => res.json({ ok: true }));

  const api = express.Router();
  api.use(exigirChaveDeApi(config.apiKey));
  api.use("/auth", rotasAuth(db, auth, limitar(config.limiteLoginPorMinuto, "Muitas tentativas de login. Aguarde um minuto.")));
  api.use("/usuarios", auth.autenticar, rotasUsuarios(db, auth));
  api.use("/perfis", auth.autenticar, rotasPerfis(db, auth));
  api.use("/funcionalidades", auth.autenticar, rotasFuncionalidades(db, auth));
  api.use("/pecas", auth.autenticar, reservas.emDia, rotasPecas(db, auth));
  api.use("/sacola", auth.autenticar, rotasSacola(db, auth, config, reservas));
  api.use("/pedidos", auth.autenticar, rotasPedidos(db, auth, config, reservas));
  api.use("/consignacoes", auth.autenticar, rotasConsignacao(db, auth));
  const painel = rotasPainel(db, auth, reservas);
  api.use("/impacto", auth.autenticar, painel.impacto);
  api.use("/bastidores", auth.autenticar, painel.bastidores);
  app.use("/api", api);

  app.use((_req, _res, next) => next(new ErroHttp(404, "Rota não encontrada.")));

  // Tratador central: respostas de erro sempre no mesmo formato, sem vazar detalhes internos.
  // eslint-disable-next-line no-unused-vars
  app.use((erro, _req, res, _next) => {
    if (erro instanceof ErroHttp) return res.status(erro.status).json({ erro: erro.message, detalhes: erro.detalhes });
    if (erro.type === "entity.too.large") return res.status(413).json({ erro: "Corpo da requisição grande demais." });
    if (erro instanceof SyntaxError && "body" in erro) return res.status(400).json({ erro: "JSON inválido." });
    console.error(erro);
    res.status(500).json({ erro: "Erro interno." });
  });
  return app;
}
