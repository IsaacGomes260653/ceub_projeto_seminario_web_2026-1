import { CHAVE, SENHA } from "./demo.js";

// Entra pela API e guarda o token, sem passar pela tela de login em todo teste.
Cypress.Commands.add("entrar", (quem, senha = SENHA) => {
  const email = quem.includes("@") ? quem : `${quem}@ciranda.app`;
  cy.request({ method: "POST", url: "/api/auth/login", headers: { "X-API-Key": CHAVE }, body: { email, senha } })
    .then(({ body }) => {
      cy.visit("/", { onBeforeLoad: (win) => win.sessionStorage.setItem("ciranda.token", body.token) });
    });
});

// Sessão simulada (mock): o front acredita que está logado e toda chamada à API é interceptada.
Cypress.Commands.add("entrarSimulado", (fixtureDoUsuario = "usuario-admin.json") => {
  cy.intercept("GET", "/api/auth/eu", { fixture: fixtureDoUsuario }).as("eu");
  cy.visit("/", { onBeforeLoad: (win) => win.sessionStorage.setItem("ciranda.token", "token-simulado") });
});

Cypress.Commands.add("linha", (nome) => cy.contains("th[scope=row]", nome).parent("tr"));

// O pacote 3D da arara pesa na máquina do CI, que não tem placa de vídeo, e deixa os testes lentos.
// Por padrão ele é trocado por um script vazio: o site se comporta como em um aparelho sem WebGL.
// A integração com a arara é testada com um dublê em 03-simulado.cy.js.
beforeEach(() => {
  cy.intercept("GET", "/arara3d/ciranda3d.js", { headers: { "content-type": "application/javascript" }, body: "" });
});
