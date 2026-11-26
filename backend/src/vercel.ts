import { criarApp } from "./app.js";
import { lerConfig } from "./config.js";

// Entrada para hospedagem sem servidor (Vercel): monta a aplicação uma vez e devolve o servidor Express,
// que o arquivo servidor.js entrega à plataforma.
export async function criar() {
  const { servidor } = await criarApp(lerConfig());
  return servidor;
}
