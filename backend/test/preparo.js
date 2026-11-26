import fs from "node:fs";
import { afterEach } from "vitest";
import { abertos } from "./apoio.js";

// Depois de cada teste, fecha as aplicações abertas e apaga os bancos temporários.
afterEach(async () => {
  for (const { app, db, arquivo } of abertos.splice(0)) {
    db.close();
    await app.close();
    for (const sufixo of ["", "-journal", "-wal", "-shm"]) fs.rmSync(arquivo + sufixo, { force: true });
  }
});
