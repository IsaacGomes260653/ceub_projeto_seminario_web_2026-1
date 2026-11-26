import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/preparo.js"],
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Fora da conta: o cliente gerado pelo Prisma, o SQL empacotado e os dois arquivos que só sobem o servidor.
      exclude: ["src/banco/cliente/**", "src/banco/migracoes.ts", "src/main.ts", "src/vercel.ts"],
      reporter: ["text", "html"],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
