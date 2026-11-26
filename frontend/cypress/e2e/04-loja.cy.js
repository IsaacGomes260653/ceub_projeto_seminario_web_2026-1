// A loja do começo ao fim, contra a API real: conta nova, sacola, Pix simulado, consignação e bastidores.
// Os testes deste arquivo contam uma história só e rodam em ordem.
const sufixo = Date.now();
const bolsa = `Bolsa de couro ${sufixo}`;

describe("loja: compra, consignação e bastidores", () => {
  it("cria uma conta e entra como Cliente", () => {
    cy.visit("/entrar");
    cy.contains("a", "Criar conta").click();
    cy.get("#cadastro-senha").type("123");
    cy.contains("button", "Criar conta").click();
    cy.get("#cadastro-nome").should("have.attr", "aria-invalid", "true").and("be.focused");
    cy.get("#cadastro-nome").type("Camila Prado");
    cy.get("#cadastro-email").type(`camila${sufixo}@ciranda.app`);
    cy.get("#cadastro-senha").clear().type("senha-forte-1");
    cy.contains("button", "Criar conta").click();
    cy.contains("h1", "Catálogo");
    cy.contains("header", "Camila");
    cy.get("nav[aria-label=Principal] a").should("have.length", 4);
  });

  it("reserva uma peça, fecha o pedido e paga com Pix simulado", () => {
    cy.entrar("ana");
    cy.contains("a.abre-peca", "Jaqueta jeans oversized").click({ force: true });
    cy.contains("button", "Colocar na sacola").click();
    cy.contains("[role=status]", "reservada por 30 minutos");
    cy.contains("a", "Ver a sacola").click();
    cy.contains(".linhas li", "Jaqueta jeans oversized").should("contain", "Reservada para você até");
    cy.contains(".fecho", "R$ 129,90");
    cy.contains("button", "Fechar pedido").click();
    cy.contains("h2", "Pague com Pix até");
    cy.get(".codigo").should("contain", "PIX-SIMULADO-");
    cy.contains("button", "Confirmar pagamento simulado").click();
    cy.get("[role=dialog]").should("contain", "Pix confirmado").and("contain", "Jaqueta jeans oversized ganhou mais uma volta na roda.");
    cy.get(".confete").should("have.length.at.least", 1);
    cy.focused().should("contain", "Acompanhar pedido").click();
    cy.get("[role=dialog]").should("not.exist");
    cy.contains("h2", "Andamento");
    cy.get(".etapas li[aria-current=step]").should("contain", "Pago");
    cy.contains("113 pontos");
    cy.contains("nav a", "Pedidos").click();
    cy.get(".numeros").should("contain", "113").and("contain", "2.320 L");
  });

  it("quem chega depois vê a peça vendida e não consegue comprar", () => {
    cy.entrar("lucia");
    cy.contains("a.abre-peca", "Jaqueta jeans oversized").click({ force: true });
    cy.contains(".situacao", "Vendida");
    cy.contains("button", "Colocar na sacola").should("not.exist");
  });

  it("envia uma peça em consignação", () => {
    cy.entrar("ana");
    cy.contains("nav a", "Vender").click();
    cy.get("#vender-titulo").type(bolsa);
    cy.get("#vender-categoria").select("Bolsas e acessórios");
    cy.get("#vender-conservacao").select("Bom estado");
    cy.get("#vender-preco").type("180");
    cy.contains(".repasse-previsto", "R$ 108,00");
    cy.contains("button", "Enviar para análise").click();
    cy.contains("[role=status]", "Peça enviada para análise");
    cy.contains(".linhas li", bolsa).should("contain", "Em análise");
    cy.contains("nav a", "Catálogo").click();
    cy.contains("h1", "Catálogo");
    cy.contains(bolsa).should("not.exist");
  });

  it("a administradora aprova a peça, vê o repasse e move o pedido", () => {
    cy.entrar("lucia");
    cy.contains("nav a", "Bastidores").click();
    cy.contains(".numeros", "R$ 77,94");
    cy.contains("section", "Repasses por pessoa").should("contain", "Beatriz Ribeiro");
    cy.get(`button[aria-label="Aprovar ${bolsa}"]`).click();
    cy.contains("[role=status]", `${bolsa} entrou no catálogo.`);
    cy.get('button[aria-label^="Avançar pedido"][aria-label$="Em separação"]').first().click();
    cy.contains("[role=status]", "agora está em: Em separação.");
    cy.get('button[aria-label^="Avançar pedido"][aria-label$="Enviado"]').should("exist");
  });

  it("recusa uma peça com motivo, e a dona lê o motivo", () => {
    cy.entrar("lucia");
    cy.contains("nav a", "Bastidores").click();
    cy.get('button[aria-label="Recusar Saia midi plissada"]').click();
    cy.contains("button", "Recusar peça").click();
    cy.contains("[role=alert]", "Campo obrigatório.");
    cy.focused().type("Barra descosturada.");
    cy.contains("button", "Recusar peça").click();
    cy.contains("[role=status]", "Saia midi plissada foi recusada.");
    cy.entrar("beatriz");
    cy.contains("nav a", "Vender").click();
    cy.contains(".linhas li", "Saia midi plissada").should("contain", "Motivo: Barra descosturada.");
  });

  it("a peça aprovada aparece no catálogo e a sacola cabe no celular", () => {
    cy.viewport(390, 844);
    cy.entrar("beatriz");
    cy.contains("a.abre-peca", bolsa).click({ force: true });
    cy.contains("button", "Colocar na sacola").click();
    cy.contains("a", "Ver a sacola").click();
    cy.contains(".linhas li", bolsa);
    cy.document().then((d) => expect(d.documentElement.scrollWidth).to.be.at.most(390));
    cy.get(`button[aria-label="Tirar ${bolsa} da sacola"]`).click();
    cy.contains("Sua sacola está vazia.");
  });
});
