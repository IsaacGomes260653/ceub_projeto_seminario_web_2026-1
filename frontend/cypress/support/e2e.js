// Entra pela API e guarda o token, sem passar pela tela de login em todo teste.
Cypress.Commands.add("entrar", (quem, senha = Cypress.env("senha")) => {
  const email = quem.includes("@") ? quem : `${quem}@ciranda.app`;
  cy.request({ method: "POST", url: "/api/auth/login", headers: { "X-API-Key": Cypress.env("apiKey") }, body: { email, senha } })
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
