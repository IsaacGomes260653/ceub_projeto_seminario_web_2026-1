import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Em desenvolvimento, /api vai para o backend local. Assim o navegador fala com uma origem só.
  server: { port: 5173, proxy: { "/api": "http://localhost:3333" } },
  preview: { port: 4173, strictPort: true, proxy: { "/api": "http://localhost:3333" } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/teste/preparar.js",
    css: false,
    include: ["src/**/*.test.{js,jsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/teste/**", "src/**/*.test.{js,jsx}"],
      reporter: ["text", "text-summary", "lcov"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
