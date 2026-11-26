import { criarApp } from "./app.js";
import { lerConfig } from "./config.js";
import { abrirBanco } from "./db.js";

try { process.loadEnvFile?.(); } catch { /* sem arquivo .env: usa os padrões */ }
const config = lerConfig();
const app = criarApp(abrirBanco(config.banco), config);
app.listen(config.porta, () => console.log(`API do Ciranda em http://localhost:${config.porta}`));
