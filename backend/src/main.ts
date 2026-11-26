import { criarApp } from "./app.js";
import { lerConfig } from "./config.js";

try { process.loadEnvFile?.(); } catch { /* sem arquivo .env: usa os padrões */ }
const config = lerConfig();
const { app } = await criarApp(config);
await app.listen(config.porta);
console.log(`API do Ciranda em http://localhost:${config.porta} (documentação em /api/docs)`);
