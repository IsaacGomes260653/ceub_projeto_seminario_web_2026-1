/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // O Materialize já traz o próprio reset. Desligar o preflight evita que os dois briguem.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        ceub: { roxo: "#662C92", escuro: "#43054E", magenta: "#BF0087", lilas: "#F3EAFB", rosa: "#EC0089", amarelo: "#FDE100", tinta: "#1A1122", cinza: "#5E5568", linha: "#D9CFE4" },
      },
      fontFamily: {
        titulo: ['"Bricolage Grotesque"', '"Hanken Grotesk"', "system-ui", "sans-serif"],
        corpo: ['"Hanken Grotesk"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
