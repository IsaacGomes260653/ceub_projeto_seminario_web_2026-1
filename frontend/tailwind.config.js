/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // O Materialize já traz o próprio reset. Desligar o preflight evita que os dois briguem.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        ceub: { roxo: "#4B0E82", escuro: "#2E0854", magenta: "#C2006B", lilas: "#F3EAFB", tinta: "#1A1122", cinza: "#5E5568", linha: "#D9CFE4" },
      },
      fontFamily: {
        titulo: ['"Bricolage Grotesque"', '"Hanken Grotesk"', "system-ui", "sans-serif"],
        corpo: ['"Hanken Grotesk"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
