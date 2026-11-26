// Testes com a API simulada (mock com fixtures): o Cypress responde no lugar do servidor.
// Servem para os casos difíceis de provocar de verdade: servidor fora do ar, sessão vencida, lista vazia.
describe("telas com a API simulada", () => {
  it("desenha o catálogo a partir da fixture", () => {
    cy.intercept("GET", "/api/pecas*", { fixture: "pecas.json" }).as("pecas");
    cy.entrarSimulado("usuario-cliente.json");
    cy.wait("@pecas").its("request.headers").should("include", { "x-api-key": "ciranda-dev-key", authorization: "Bearer token-simulado" });
    cy.contains("[role=status]", "2 peças encontradas");
    cy.contains(".peca", "Jaqueta de teste").should("contain", "4ª volta").and("contain", "150,00");
    cy.contains(".peca", "Bolsa de teste").should("contain", "Vendida").and("contain", "sem foto");
  });

  it("manda os filtros na consulta", () => {
    cy.intercept("GET", "/api/pecas*", { fixture: "pecas.json" }).as("pecas");
    cy.entrarSimulado("usuario-cliente.json");
    cy.wait("@pecas");
    cy.get("#filtro-categoria").select("Vestidos");
    cy.wait("@pecas").its("request.url").should("include", "categoria=Vestidos");
    cy.get("#busca").type("linho");
    cy.wait("@pecas").its("request.url").should("include", "q=linho");
  });

  it("mostra erro quando o servidor falha e se recupera ao tentar de novo", () => {
    cy.intercept("GET", "/api/pecas*", { fixture: "pecas.json" });
    cy.intercept("GET", "/api/perfis", []);
    let chamadas = 0;
    cy.intercept("GET", "/api/usuarios", (req) => {
      chamadas += 1;
      if (chamadas === 1) req.reply({ statusCode: 500, body: { erro: "Erro interno." } });
      else req.reply([{ id: 9, nome: "Usuária da fixture", email: "f@ciranda.app", perfilId: 1, perfil: "Administradora", ativo: true }]);
    }).as("usuarios");
    cy.entrarSimulado();
    cy.contains("nav a", "Usuários").click();
    cy.get("[role=alert]").should("contain", "Erro interno.");
    cy.contains("button", "Tentar de novo").click();
    cy.linha("Usuária da fixture").should("be.visible");
  });

  it("mostra o estado vazio", () => {
    cy.intercept("GET", "/api/pecas*", []);
    cy.intercept("GET", "/api/funcionalidades", []);
    cy.entrarSimulado();
    cy.contains("nav a", "Funcionalidades").click();
    cy.contains("Nada cadastrado ainda");
  });

  it("volta ao login com aviso quando a sessão expira", () => {
    cy.intercept("GET", "/api/pecas*", { fixture: "pecas.json" });
    cy.intercept("GET", "/api/perfis", { statusCode: 401, body: { erro: "Sessão expirada. Entre de novo." } });
    cy.intercept("GET", "/api/funcionalidades", []);
    cy.entrarSimulado();
    cy.contains("nav a", "Perfis").click();
    cy.contains("[role=status]", "Sua sessão expirou. Entre de novo.");
    cy.contains("h2", "Entrar");
  });
});

describe("celular e teclado", () => {
  beforeEach(() => {
    cy.intercept("GET", "/api/pecas*", { fixture: "pecas.json" });
    cy.intercept("GET", "/api/usuarios", [{ id: 9, nome: "Usuária da fixture", email: "f@ciranda.app", perfilId: 1, perfil: "Administradora", ativo: true }]);
    cy.intercept("GET", "/api/perfis", []);
  });

  it("no celular o menu abre por botão e a página não rola de lado", () => {
    cy.viewport(390, 844);
    cy.entrarSimulado();
    cy.get("nav[aria-label=Principal]").should("not.be.visible");
    cy.contains("button", "Menu").should("have.attr", "aria-expanded", "false").click();
    cy.contains("button", "Fechar menu").should("have.attr", "aria-expanded", "true");
    cy.contains("nav a", "Usuários").click();
    cy.contains("h1", "Usuários");
    cy.get("nav[aria-label=Principal]").should("not.be.visible");
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(390));
  });

  it("tem atalho de teclado para pular ao conteúdo e um título por página", () => {
    cy.entrarSimulado();
    cy.contains("h1", "Catálogo");
    cy.get("a.pular").should("have.attr", "href", "#conteudo").focus().should("be.visible");
    cy.get("h1").should("have.length", 1);
    cy.get("html").should("have.attr", "lang", "pt-BR");
    cy.get("#busca").should("have.attr", "type", "search");
    cy.get("label[for=busca]").should("contain", "Buscar por peça ou marca");
  });

  it("toda imagem tem texto alternativo e todo campo tem rótulo", () => {
    cy.entrarSimulado();
    cy.get("img").each(($img) => expect($img).to.have.attr("alt"));
    cy.contains("nav a", "Usuários").click();
    cy.contains("button", "Novo usuário").click();
    cy.get("form input, form select").each(($campo) => {
      const id = $campo.attr("id");
      cy.get(`label[for="${id}"], label:has(#${id})`).should("exist");
    });
  });
});

// O pacote 3D é trocado por um dublê (stub), para o teste não depender de placa de vídeo.
describe("arara 3D", () => {
  const visitar = (ciranda3D) => {
    cy.intercept("GET", "/api/auth/eu", { fixture: "usuario-cliente.json" });
    cy.intercept("GET", "/api/pecas*", { fixture: "pecas.json" });
    cy.visit("/", { onBeforeLoad: (win) => { win.sessionStorage.setItem("ciranda.token", "token-simulado"); win.Ciranda3D = ciranda3D; } });
  };

  it("pendura só as peças com modelo 3D e destaca na lista a que foi escolhida", () => {
    const arara = cy.stub().returns(() => {}).as("arara");
    visitar({ disponivel: () => true, arara });
    cy.get("section[aria-label='Arara 3D']").should("contain", "1 peça gira aqui");
    cy.get("@arara").should("have.been.calledOnce").then((stub) => {
      const [, itens, escolher] = stub.firstCall.args;
      expect(itens).to.have.length(1);
      expect(itens[0]).to.include({ kind: "crewneck", colour: "#5C7894" });
      expect(itens[0].name).to.contain("Jaqueta de teste");
      escolher(0);
    });
    cy.contains(".peca", "Jaqueta de teste").should("have.class", "destaque").and("have.focus");
  });

  it("sem WebGL a arara some e o catálogo continua inteiro", () => {
    visitar({ disponivel: () => false });
    cy.contains("[role=status]", "2 peças encontradas");
    cy.get("section[aria-label='Arara 3D']").should("not.exist");
  });
});
