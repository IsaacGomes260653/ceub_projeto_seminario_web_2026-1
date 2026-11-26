// Os três cadastros pedidos, do começo ao fim, contra a API real.
const sufixo = Date.now();

describe("CRUD 03: funcionalidades, CRUD 02: perfis e CRUD 01: usuários", () => {
  const funcionalidade = { nome: `Ver relatórios ${sufixo}`, chave: `relatorios.ver${sufixo}` };
  const perfil = `Curadoria ${sufixo}`;
  const usuario = { nome: `Thiago Teste ${sufixo}`, email: `thiago${sufixo}@ciranda.app`, senha: "senha-forte-1" };

  beforeEach(() => cy.entrar("lucia"));

  it("cria uma funcionalidade", () => {
    cy.contains("nav a", "Funcionalidades").click();
    cy.contains("button", "Nova funcionalidade").click();
    cy.focused().should("contain", "Nova funcionalidade");
    cy.get("#funcionalidades-nome").type(funcionalidade.nome);
    cy.get("#funcionalidades-chave").type("Chave Inválida");
    cy.contains("button", "Salvar").click();
    cy.get("#funcionalidades-chave").should("have.attr", "aria-invalid", "true");
    cy.get("#funcionalidades-chave").clear().type(funcionalidade.chave);
    cy.contains("button", "Salvar").click();
    cy.contains("[role=status]", "Funcionalidade criada com sucesso.");
    cy.linha(funcionalidade.nome).should("contain", funcionalidade.chave);
  });

  it("cria um perfil com essa funcionalidade e o catálogo", () => {
    cy.contains("nav a", "Perfis").click();
    cy.contains("button", "Novo perfil").click();
    cy.get("#perfis-nome").type(perfil);
    cy.contains("label", "Ver o catálogo").click();
    cy.contains("label", funcionalidade.nome).click();
    cy.contains("button", "Salvar").click();
    cy.contains("[role=status]", "Perfil criado com sucesso.");
    cy.linha(perfil).should("contain", funcionalidade.nome).and("contain", "Ver o catálogo");
  });

  it("cria um usuário nesse perfil, e ele entra vendo só o catálogo", () => {
    cy.contains("nav a", "Usuários").click();
    cy.contains("button", "Novo usuário").click();
    cy.get("#usuarios-nome").type(usuario.nome);
    cy.get("#usuarios-email").type(usuario.email);
    cy.get("#usuarios-perfilId").select(perfil);
    cy.get("#usuarios-senha").type(usuario.senha);
    cy.contains("button", "Salvar").click();
    cy.contains("[role=status]", "Usuário criado com sucesso.");
    cy.linha(usuario.nome).should("contain", perfil).and("contain", "Ativo");

    cy.entrar(usuario.email, usuario.senha);
    cy.get("nav[aria-label=Principal] a").should("have.length", 1).and("contain", "Catálogo");
  });

  it("edita o usuário e bloqueia e-mail repetido", () => {
    cy.contains("nav a", "Usuários").click();
    cy.get(`button[aria-label="Editar ${usuario.nome}"]`).click();
    cy.get("#usuarios-email").clear().type("ana@ciranda.app");
    cy.contains("button", "Salvar").click();
    cy.get("[role=alert]").should("contain", "Já existe um usuário com esse e-mail.");
    cy.get("#usuarios-email").clear().type(usuario.email);
    cy.get("#usuarios-ativo").uncheck({ force: true });
    cy.contains("button", "Salvar").click();
    cy.linha(usuario.nome).should("contain", "Inativo");
    cy.request({ method: "POST", url: "/api/auth/login", failOnStatusCode: false, headers: { "X-API-Key": Cypress.env("apiKey") }, body: { email: usuario.email, senha: usuario.senha } })
      .its("status").should("eq", 401);
  });

  it("não remove perfil nem funcionalidade em uso, e remove na ordem certa", () => {
    cy.contains("nav a", "Perfis").click();
    cy.get(`button[aria-label="Remover ${perfil}"]`).click();
    cy.contains("button", "Sim, remover").click();
    cy.contains("[role=status]", "Há usuários com este perfil");

    cy.contains("nav a", "Usuários").click();
    cy.get(`button[aria-label="Remover ${usuario.nome}"]`).click();
    cy.contains("button", "Não").click();
    cy.linha(usuario.nome).should("exist");
    cy.get(`button[aria-label="Remover ${usuario.nome}"]`).click();
    cy.contains("button", "Sim, remover").click();
    cy.contains("[role=status]", "Usuário removido.");
    cy.contains("th[scope=row]", usuario.nome).should("not.exist");

    cy.contains("nav a", "Funcionalidades").click();
    cy.get(`button[aria-label="Remover ${funcionalidade.nome}"]`).click();
    cy.contains("button", "Sim, remover").click();
    cy.contains("[role=status]", "em uso por um ou mais perfis");

    cy.contains("nav a", "Perfis").click();
    cy.get(`button[aria-label="Remover ${perfil}"]`).click();
    cy.contains("button", "Sim, remover").click();
    cy.contains("[role=status]", "Perfil removido.");

    cy.contains("nav a", "Funcionalidades").click();
    cy.get(`button[aria-label="Remover ${funcionalidade.nome}"]`).click();
    cy.contains("button", "Sim, remover").click();
    cy.contains("[role=status]", "Funcionalidade removida.");
    cy.contains("th[scope=row]", funcionalidade.nome).should("not.exist");
  });
});

describe("peças do brechó", () => {
  const titulo = `Saia de teste ${sufixo}`;
  it("fornecedor cadastra, a cliente vê no catálogo, e o fornecedor remove", () => {
    cy.entrar("beatriz");
    cy.contains("nav a", "Peças").click();
    cy.contains("button", "Nova peça").click();
    cy.get("#pecas-titulo").type(titulo);
    cy.get("#pecas-categoria").select("Saias");
    cy.get("#pecas-conservacao").select("Ótimo estado");
    cy.get("#pecas-preco").type("69.90");
    cy.get("#pecas-foto").select("saia verde");
    cy.contains("button", "Salvar").click();
    cy.contains("[role=status]", "Peça criada com sucesso.");

    cy.entrar("ana");
    cy.get("#busca").type(titulo);
    cy.contains("[role=status]", "1 peça encontrada");
    cy.contains(".peca", titulo).should("contain", "R$").and("contain", "69,90").find("img").should("have.attr", "src", "/fotos/saia-verde.webp");

    cy.entrar("beatriz");
    cy.contains("nav a", "Peças").click();
    cy.get(`button[aria-label="Remover ${titulo}"]`).click();
    cy.contains("button", "Sim, remover").click();
    cy.contains("[role=status]", "Peça removida.");
  });
});
