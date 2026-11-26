import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import express from "express";
import { AppModule } from "./app.module.js";
import { COOKIE_DE_SESSAO } from "./auth/auth.controller.js";
import { aplicarSeguranca, ROTA_DA_DOCUMENTACAO } from "./comum/seguranca.js";
import type { Config } from "./config.js";

const SWAGGER_UI = "https://unpkg.com/swagger-ui-dist@5";

// Documentação Swagger (OpenAPI), montada a partir dos decoradores dos controladores.
// A página fica em /api/docs e o JSON em /api/docs-json.
function documentar(app: INestApplication) {
  const documento = SwaggerModule.createDocument(app, new DocumentBuilder()
    .setTitle("Ciranda Web")
    .setDescription("API do brechó Ciranda: acesso, cadastros de usuários, perfis e funcionalidades, peças e a loja. "
      + "Toda rota pede a chave de API no cabeçalho X-API-Key. As rotas com cadeado pedem também o JWT, obtido em POST /api/auth/login.")
    .setVersion("2.0")
    .addApiKey({ type: "apiKey", name: "X-API-Key", in: "header", description: "Chave do cliente autorizado a falar com a API." }, "chave-de-api")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" })
    .addCookieAuth(COOKIE_DE_SESSAO)
    .build());
  SwaggerModule.setup(ROTA_DA_DOCUMENTACAO, app, documento, {
    customSiteTitle: "Ciranda Web: documentação da API",
    customCssUrl: `${SWAGGER_UI}/swagger-ui.css`,
    customJs: [`${SWAGGER_UI}/swagger-ui-bundle.js`, `${SWAGGER_UI}/swagger-ui-standalone-preset.js`],
  });
}

// Monta a aplicação Nest sobre um servidor Express. Recebe a configuração para os testes poderem trocá-la.
export async function criarApp(config: Config) {
  const servidor = express();
  aplicarSeguranca(servidor, config);
  const app = await NestFactory.create(AppModule.com(config), new ExpressAdapter(servidor), { bodyParser: false, logger: ["error", "warn"] });
  documentar(app);
  await app.init();
  return { app, servidor };
}
