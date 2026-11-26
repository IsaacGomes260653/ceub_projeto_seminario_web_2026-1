// Ponta a ponta de verdade: navegador, front-end e API com banco, sem nada simulado.
describe("acesso e perfis", () => {
  it("entra pela tela de login e cai no catálogo", () => {
    cy.visit("/");
    cy.location("pathname").should("eq", "/entrar");
    cy.get("#login-email").type("lucia@ciranda.app");
    cy.get("#login-senha").type("ciranda123");
    cy.contains("button", "Entrar").click();
    cy.contains("h1", "Catálogo").should("be.visible");
    cy.get("nav[aria-label=Principal] a").should("have.length", 5);
  });

  it("recusa senha errada com mensagem acessível", () => {
    cy.visit("/entrar");
    cy.get("#login-email").type("lucia@ciranda.app");
    cy.get("#login-senha").type("senha-errada{enter}");
    cy.get("[role=alert]").should("contain", "E-mail ou senha incorretos.");
    cy.location("pathname").should("eq", "/entrar");
  });

  it("cada perfil vê só as próprias funcionalidades", () => {
    cy.entrar("ana");
    cy.get("nav[aria-label=Principal] a").should("have.length", 1).and("contain", "Catálogo");
    cy.visit("/usuarios", { onBeforeLoad: (w) => w.sessionStorage.getItem("ciranda.token") });
    cy.contains("h1", "Sem acesso");

    cy.entrar("beatriz");
    cy.get("nav[aria-label=Principal] a").then(($a) => expect([...$a].map((a) => a.textContent)).to.deep.equal(["Catálogo", "Peças"]));
  });

  it("a API barra o cliente mesmo com requisição direta", () => {
    cy.request({ method: "POST", url: "/api/auth/login", headers: { "X-API-Key": Cypress.env("apiKey") }, body: { email: "ana@ciranda.app", senha: "ciranda123" } }).then(({ body }) => {
      cy.request({ url: "/api/usuarios", failOnStatusCode: false, headers: { "X-API-Key": Cypress.env("apiKey"), Authorization: `Bearer ${body.token}` } }).its("status").should("eq", 403);
      cy.request({ url: "/api/usuarios", failOnStatusCode: false, headers: { Authorization: `Bearer ${body.token}` } }).its("status").should("eq", 401);
    });
  });

  it("sai e volta ao login", () => {
    cy.entrar("lucia");
    cy.contains("button", "Sair").click();
    cy.contains("h2", "Entrar");
    cy.window().then((w) => expect(w.sessionStorage.getItem("ciranda.token")).to.be.null);
  });
});
