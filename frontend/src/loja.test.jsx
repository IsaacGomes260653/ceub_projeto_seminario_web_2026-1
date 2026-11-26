import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { abrir } from "./teste/apoio.jsx";

const MEIA_HORA = 30 * 60 * 1000;
// Deixa a calça jeans (id 1) na sacola da Ana (id 1), como se ela tivesse acabado de reservar.
const comSacola = (banco) => { banco.pecas[0].situacao = "Reservada"; banco.sacola.push({ pecaId: 1, usuarioId: 1, reservadaAte: banco.agora + MEIA_HORA }); };
const comPedido = (situacao = "Aguardando pagamento", extra = {}) => (banco) => {
  banco.pecas[0].situacao = situacao === "Aguardando pagamento" ? "Reservada" : "Vendida";
  banco.pecas[0].donoId = 2;
  banco.compras.push({
    id: 1, usuarioId: 1, cliente: "Ana Costa", total: 119.9, situacao, pix: "PIX-SIMULADO-0123456789ABCDEF", rastreio: situacao === "Aguardando pagamento" ? "" : "CR123456789BR",
    pontos: situacao === "Aguardando pagamento" ? 0 : 210, agua: 2911, co2: 21, expiraEm: banco.agora + MEIA_HORA, criadoEm: banco.agora,
    itens: [{ pecaId: 1, titulo: "Calça jeans reta", categoria: "Calças jeans", preco: 119.9 }], eventos: [{ etapa: "Pedido criado", quando: banco.agora }], ...extra,
  });
};
const comFila = (banco) => { banco.pecas.push({ id: 9, titulo: "Saia midi plissada", marca: "Amaro", tamanho: "M", categoria: "Saias", conservacao: "Ótimo estado", preco: 69.9, voltas: 1, foto: "", situacao: "Em análise", donoId: 2 }); };

describe("sacola", () => {
  it("reserva a peça pela página dela e mostra o caminho para a sacola", async () => {
    const { usuario, falsa } = abrir({ rota: "/catalogo/1", como: "ana" });
    await usuario.click(await screen.findByRole("button", { name: "Colocar na sacola" }));
    expect(await screen.findByText(/reservada por 30 minutos/)).toBeInTheDocument();
    expect(falsa.ultimo("POST").corpo).toEqual({ pecaId: 1 });
    expect(screen.getByText("Reservada")).toBeInTheDocument();
    await usuario.click(screen.getByRole("link", { name: "Ver a sacola" }));
    expect(await screen.findByRole("link", { name: "Calça jeans reta" })).toBeInTheDocument();
    expect(screen.getByText(/Reservada para você até \d\d:\d\d/)).toBeInTheDocument();
  });
  it("avisa quando outra pessoa reservou antes e atualiza a situação", async () => {
    const { usuario, falsa } = abrir({ rota: "/catalogo/1", como: "ana" });
    const botao = await screen.findByRole("button", { name: "Colocar na sacola" });
    falsa.banco.pecas[0].situacao = "Reservada";
    await usuario.click(botao);
    expect(await screen.findByRole("alert")).toHaveTextContent("reservada por outra pessoa");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Colocar na sacola" })).toBeNull());
  });
  it("não oferece a sacola para peça que não está disponível", async () => {
    abrir({ rota: "/catalogo/2", como: "ana" });
    await screen.findByRole("heading", { name: "Vestido midi floral" });
    expect(screen.queryByRole("button", { name: "Colocar na sacola" })).toBeNull();
  });
  it("vazia, convida a ir ao catálogo", async () => {
    abrir({ rota: "/sacola", como: "ana" });
    expect(await screen.findByText("Sua sacola está vazia.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver o catálogo" })).toHaveAttribute("href", "/catalogo");
  });
  it("tira um item e a peça volta a ficar disponível", async () => {
    const { usuario, falsa } = abrir({ rota: "/sacola", como: "ana", preparar: comSacola });
    await usuario.click(await screen.findByRole("button", { name: "Tirar Calça jeans reta da sacola" }));
    expect(await screen.findByText("Sua sacola está vazia.")).toBeInTheDocument();
    expect(falsa.banco.pecas[0].situacao).toBe("Disponível");
  });
  it("mostra o erro se tirar falhar e recarrega a lista", async () => {
    const { usuario, falsa } = abrir({ rota: "/sacola", como: "ana", preparar: comSacola });
    const botao = await screen.findByRole("button", { name: "Tirar Calça jeans reta da sacola" });
    falsa.banco.sacola.length = 0;
    await usuario.click(botao);
    expect(await screen.findByRole("alert")).toHaveTextContent("Item da sacola não encontrado.");
    expect(await screen.findByText("Sua sacola está vazia.")).toBeInTheDocument();
  });
  it("fecha o pedido e leva para o Pix", async () => {
    const { usuario } = abrir({ rota: "/sacola", como: "ana", preparar: comSacola });
    expect(await screen.findByText("R$ 119,90", { selector: ".fecho strong" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Fechar pedido" }));
    expect(await screen.findByRole("heading", { name: /Pague com Pix até \d\d:\d\d/ })).toBeInTheDocument();
    expect(screen.getByText("PIX-SIMULADO-0123456789ABCDEF")).toBeInTheDocument();
  });
  it("avisa se a reserva venceu entre abrir a sacola e fechar o pedido", async () => {
    const { usuario, falsa } = abrir({ rota: "/sacola", como: "ana", preparar: comSacola });
    const botao = await screen.findByRole("button", { name: "Fechar pedido" });
    falsa.banco.sacola.length = 0;
    await usuario.click(botao);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sua sacola está vazia.");
  });
  it("mostra erro de rede com botão para tentar de novo", async () => {
    const { usuario, falsa } = abrir({ rota: "/sacola", como: "ana" });
    await screen.findByText("Sua sacola está vazia.");
    falsa.buscar.mockRejectedValueOnce(new Error("rede"));
    await usuario.click(screen.getByRole("link", { name: "Pedidos" }));
    await usuario.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Você ainda não fez nenhum pedido.")).toBeInTheDocument();
  });
});

describe("pedido com Pix simulado", () => {
  it("confirma o pagamento e mostra andamento, rastreio e pontos", async () => {
    const { usuario, falsa } = abrir({ rota: "/pedidos/1", como: "ana", preparar: comPedido() });
    expect(await screen.findByText(/Este Pix é simulado/)).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Confirmar pagamento simulado" }));
    // A tela de comprado aparece com o foco no botão principal e some ao fechar.
    const festa = await screen.findByRole("dialog", { name: "Pix confirmado" });
    expect(within(festa).getByText("Calça jeans reta ganhou mais uma volta na roda.")).toBeInTheDocument();
    expect(within(festa).getByText("2.911 L")).toBeInTheDocument();
    expect(within(festa).getByText("21,0 kg")).toBeInTheDocument();
    expect(within(festa).getByText("210")).toBeInTheDocument();
    expect(within(festa).getByRole("link", { name: "Continuar comprando" })).toHaveAttribute("href", "/catalogo");
    expect(within(festa).getByRole("button", { name: "Acompanhar pedido" })).toHaveFocus();
    await usuario.click(within(festa).getByRole("button", { name: "Acompanhar pedido" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const andamento = (await screen.findByRole("heading", { name: "Andamento" })).closest("section");
    expect(within(andamento).getByText("Pago").closest("li")).toHaveAttribute("aria-current", "step");
    expect(within(andamento).getByText("CR123456789BR")).toBeInTheDocument();
    expect(within(andamento).getByText("210 pontos")).toBeInTheDocument();
    expect(screen.getByText("Pagamento confirmado")).toBeInTheDocument();
    expect(falsa.banco.pecas[0]).toMatchObject({ situacao: "Vendida", voltas: 4 });
    expect(screen.queryByRole("button", { name: "Confirmar pagamento simulado" })).toBeNull();
  });
  it("a tela de comprado fecha com Esc, fala das peças no plural e solta confetes quando o navegador anima", async () => {
    const animar = vi.fn(() => ({}));
    HTMLElement.prototype.animate = animar;
    try {
      const { usuario } = abrir({ rota: "/pedidos/1", como: "ana", preparar: comPedido("Aguardando pagamento", { itens: [{ pecaId: 1, titulo: "Calça jeans reta", categoria: "Calças jeans", preco: 60, foto: "calca-jeans.webp" }, { pecaId: 2, titulo: "Vestido midi floral", categoria: "Vestidos", preco: 59.9, foto: "" }] }) });
      await usuario.click(await screen.findByRole("button", { name: "Confirmar pagamento simulado" }));
      const festa = await screen.findByRole("dialog", { name: "Pix confirmado" });
      expect(within(festa).getByText("As 2 peças ganharam mais uma volta na roda.")).toBeInTheDocument();
      expect(animar).toHaveBeenCalledTimes(44);
      expect(document.querySelectorAll(".confete")).toHaveLength(44);
      animar.mock.results.forEach((r) => r.value.onfinish());
      expect(document.querySelectorAll(".confete")).toHaveLength(0);
      await waitFor(() => expect(within(festa).getByText("266")).toBeInTheDocument(), { timeout: 3000 });
      await usuario.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
    } finally { delete HTMLElement.prototype.animate; }
  });
  it("não reabre a tela de comprado ao voltar a um pedido já pago", async () => {
    abrir({ rota: "/pedidos/1", como: "ana", preparar: comPedido("Pago") });
    await screen.findByRole("heading", { name: "Andamento" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("copia o código do Pix e avisa", async () => {
    const { usuario } = abrir({ rota: "/pedidos/1", como: "ana", preparar: comPedido() });
    const escrever = vi.fn().mockResolvedValue();
    await screen.findByText(/Este Pix é simulado/);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: escrever }, configurable: true });
    await usuario.click(screen.getByRole("button", { name: "Copiar código" }));
    expect(escrever).toHaveBeenCalledWith("PIX-SIMULADO-0123456789ABCDEF");
    expect(await screen.findByRole("button", { name: "Código copiado" })).toBeInTheDocument();
  });
  it("explica o que fazer quando o navegador não deixa copiar", async () => {
    const { usuario } = abrir({ rota: "/pedidos/1", como: "ana", preparar: comPedido() });
    await screen.findByText(/Este Pix é simulado/);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("negado")) }, configurable: true });
    await usuario.click(screen.getByRole("button", { name: "Copiar código" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Selecione o código e copie à mão.");
  });
  it("cancela antes de pagar e devolve a peça", async () => {
    const { usuario, falsa } = abrir({ rota: "/pedidos/1", como: "ana", preparar: comPedido() });
    await usuario.click(await screen.findByRole("button", { name: "Cancelar pedido" }));
    expect(await screen.findByText(/Você cancelou este pedido/)).toBeInTheDocument();
    expect(falsa.banco.pecas[0].situacao).toBe("Disponível");
  });
  it("mostra o erro se o pagamento for recusado e recarrega o pedido", async () => {
    const { usuario, falsa } = abrir({ rota: "/pedidos/1", como: "ana", preparar: comPedido() });
    const botao = await screen.findByRole("button", { name: "Confirmar pagamento simulado" });
    falsa.banco.compras[0].situacao = "Expirado";
    await usuario.click(botao);
    expect(await screen.findByRole("alert")).toHaveTextContent("não está aguardando pagamento");
    expect(await screen.findByText(/A reserva venceu antes do pagamento/)).toBeInTheDocument();
  });
  it("mostra item cuja peça saiu do acervo sem link quebrado", async () => {
    abrir({ rota: "/pedidos/1", como: "ana", preparar: comPedido("Entregue", { itens: [{ pecaId: null, titulo: "Peça antiga", categoria: "Saias", preco: 119.9 }], pontos: 0 }) });
    expect(await screen.findByText("Peça antiga")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Peça antiga" })).toBeNull();
    expect(screen.queryByText(/somou/)).toBeNull();
  });
  it("pedido inexistente mostra o erro", async () => {
    abrir({ rota: "/pedidos/77", como: "ana" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Pedido não encontrado.");
  });
  it("lista os pedidos com o que as compras já pouparam", async () => {
    abrir({ rota: "/pedidos", como: "ana", preparar: comPedido("Enviado") });
    const numeros = await screen.findByLabelText("O que suas compras já pouparam");
    expect(within(numeros).getByText("210")).toBeInTheDocument();
    expect(within(numeros).getByText("2.911 L")).toBeInTheDocument();
    expect(within(numeros).getByText("21,0 kg")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedido 1" })).toHaveAttribute("href", "/pedidos/1");
    expect(screen.getByText("Enviado")).toHaveClass("ok");
  });
  it("resume pedido com várias peças pela quantidade", async () => {
    abrir({ rota: "/pedidos", como: "ana", preparar: comPedido("Aguardando pagamento", { itens: [{ pecaId: 1, titulo: "A", categoria: "Saias", preco: 1 }, { pecaId: 2, titulo: "B", categoria: "Saias", preco: 1 }] }) });
    expect(await screen.findByText(/^2 peças ·/)).toBeInTheDocument();
    expect(screen.queryByLabelText("O que suas compras já pouparam")).toBeNull();
  });
});

describe("vender em consignação", () => {
  it("mostra quanto a pessoa recebe e envia a peça para análise", async () => {
    const { usuario, falsa } = abrir({ rota: "/vender", como: "ana" });
    expect(await screen.findByText(/Você ainda não enviou nenhuma peça/)).toBeInTheDocument();
    expect(screen.getByText("Informe o preço para ver quanto você recebe.")).toBeInTheDocument();
    await usuario.type(screen.getByLabelText(/O que é a peça/), "Bolsa de couro");
    await usuario.selectOptions(screen.getByLabelText(/Categoria/), "Bolsas e acessórios");
    await usuario.selectOptions(screen.getByLabelText(/Conservação/), "Bom estado");
    await usuario.type(screen.getByLabelText(/Preço de venda/), "180");
    expect(screen.getByText("R$ 108,00")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Enviar para análise" }));
    expect(await screen.findByText(/Peça enviada para análise/)).toBeInTheDocument();
    expect(falsa.ultimo("POST").corpo).toMatchObject({ titulo: "Bolsa de couro", preco: 180 });
    expect(await screen.findByText("O brechó ainda vai olhar esta peça.")).toBeInTheDocument();
    expect(screen.getByLabelText(/O que é a peça/)).toHaveValue("");
  });
  it("aponta o primeiro campo que faltou", async () => {
    const { usuario } = abrir({ rota: "/vender", como: "ana" });
    await usuario.click(await screen.findByRole("button", { name: "Enviar para análise" }));
    expect((await screen.findAllByText("Campo obrigatório.")).length).toBe(4);
    await waitFor(() => expect(screen.getByLabelText(/O que é a peça/)).toHaveFocus());
  });
  it("mostra motivo da recusa, repasse da venda e deixa retirar", async () => {
    const { usuario, falsa } = abrir({ rota: "/vender", como: "beatriz", preparar: (banco) => {
      comPedido("Pago")(banco);
      banco.pecas.push({ id: 8, titulo: "Blusa de seda", marca: "", tamanho: "", categoria: "Camisas", conservacao: "Bom estado", preco: 50, voltas: 1, foto: "", situacao: "Recusada", motivo: "Mancha na gola.", donoId: 2 });
    } });
    expect(await screen.findByText("Vendida. Seu repasse: R$ 71,94.")).toBeInTheDocument();
    expect(screen.getByText("Motivo: Mancha na gola.")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Retirar Blusa de seda" }));
    expect(await screen.findByText("Blusa de seda foi retirada.")).toBeInTheDocument();
    expect(falsa.banco.pecas.some((p) => p.id === 8)).toBe(false);
  });
  it("avisa se a retirada falhar", async () => {
    const { usuario, falsa } = abrir({ rota: "/vender", como: "beatriz", preparar: comFila });
    const botao = await screen.findByRole("button", { name: "Retirar Saia midi plissada" });
    falsa.banco.pecas.pop();
    await usuario.click(botao);
    expect(await screen.findByText("Peça em consignação não encontrada.")).toBeInTheDocument();
  });
});

describe("bastidores", () => {
  it("resume vendas e repasses", async () => {
    abrir({ rota: "/bastidores", como: "lucia", preparar: comPedido("Pago") });
    expect(await screen.findByText("R$ 119,90", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("R$ 71,94", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("R$ 47,96", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText(/2\.911 L de água e 21,0 kg de carbono/)).toBeInTheDocument();
    const repasses = (await screen.findByRole("heading", { name: "Repasses por pessoa" })).closest("section");
    expect(within(repasses).getByText("Beatriz Ribeiro")).toBeInTheDocument();
    expect(within(repasses).getByText("1 peça vendida")).toBeInTheDocument();
  });
  it("aprova uma peça da fila", async () => {
    const { usuario, falsa } = abrir({ rota: "/bastidores", como: "lucia", preparar: comFila });
    await usuario.click(await screen.findByRole("button", { name: "Aprovar Saia midi plissada" }));
    expect(await screen.findByText("Saia midi plissada entrou no catálogo.")).toBeInTheDocument();
    expect(await screen.findByText("Nenhuma peça esperando. A fila está em dia.")).toBeInTheDocument();
    expect(falsa.banco.pecas.at(-1).situacao).toBe("Disponível");
  });
  it("recusar pede motivo, mostra o erro e depois grava", async () => {
    const { usuario, falsa } = abrir({ rota: "/bastidores", como: "lucia", preparar: comFila });
    await usuario.click(await screen.findByRole("button", { name: "Recusar Saia midi plissada" }));
    const campo = screen.getByLabelText("Motivo da recusa");
    expect(campo).toHaveFocus();
    await usuario.click(screen.getByRole("button", { name: "Recusar peça" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mínimo de 3 caracteres.");
    expect(campo).toHaveFocus();
    await usuario.type(campo, "Zíper quebrado.");
    await usuario.click(screen.getByRole("button", { name: "Recusar peça" }));
    expect(await screen.findByText("Saia midi plissada foi recusada.")).toBeInTheDocument();
    expect(falsa.banco.pecas.at(-1)).toMatchObject({ situacao: "Recusada", motivo: "Zíper quebrado." });
  });
  it("desiste da recusa sem mexer na peça", async () => {
    const { usuario, falsa } = abrir({ rota: "/bastidores", como: "lucia", preparar: comFila });
    await usuario.click(await screen.findByRole("button", { name: "Recusar Saia midi plissada" }));
    await usuario.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("button", { name: "Aprovar Saia midi plissada" })).toBeInTheDocument();
    expect(falsa.banco.pecas.at(-1).situacao).toBe("Em análise");
  });
  it("avisa se a aprovação falhar", async () => {
    const { usuario, falsa } = abrir({ rota: "/bastidores", como: "lucia", preparar: comFila });
    const botao = await screen.findByRole("button", { name: "Aprovar Saia midi plissada" });
    falsa.banco.pecas.pop();
    await usuario.click(botao);
    expect(await screen.findByText("Peça em consignação não encontrada.")).toBeInTheDocument();
  });
  it("move o pedido para a etapa seguinte", async () => {
    const { usuario, falsa } = abrir({ rota: "/bastidores", como: "lucia", preparar: comPedido("Pago") });
    await usuario.click(await screen.findByRole("button", { name: "Avançar pedido 1 para Em separação" }));
    expect(await screen.findByText("Pedido 1 agora está em: Em separação.")).toBeInTheDocument();
    expect(falsa.banco.compras[0].situacao).toBe("Em separação");
    expect(await screen.findByRole("button", { name: "Avançar pedido 1 para Enviado" })).toBeInTheDocument();
  });
  it("avisa se o pedido não pode avançar", async () => {
    const { usuario, falsa } = abrir({ rota: "/bastidores", como: "lucia", preparar: comPedido("Enviado") });
    const botao = await screen.findByRole("button", { name: "Avançar pedido 1 para Entregue" });
    falsa.banco.compras[0].situacao = "Cancelado";
    await usuario.click(botao);
    expect(await screen.findByText("Só um pedido pago pode avançar.")).toBeInTheDocument();
  });
  it("abre o pedido de uma cliente e volta para os bastidores", async () => {
    const { usuario } = abrir({ rota: "/bastidores", como: "lucia", preparar: comPedido() });
    await usuario.click(await screen.findByRole("link", { name: "Pedido 1" }));
    expect(await screen.findByText("Cliente: Ana Costa")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar pagamento simulado" })).toBeNull();
    expect(screen.getByRole("link", { name: /Voltar aos bastidores/ })).toHaveAttribute("href", "/bastidores");
  });
  it("perfil sem aprovação vê os números, mas não a fila", async () => {
    abrir({ rota: "/bastidores", como: "lucia", preparar: (banco) => { banco.perfis[0].funcionalidades = [1, 9]; } });
    expect(await screen.findByText("Nenhum pedido ainda. Quando alguém fechar a sacola, o pedido aparece aqui.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Peças esperando análise" })).toBeNull();
  });
  it("cliente não entra nos bastidores", async () => {
    abrir({ rota: "/bastidores", como: "ana" });
    expect(await screen.findByRole("heading", { name: "Sem acesso" })).toBeInTheDocument();
  });
});

describe("cadastro aberto", () => {
  it("cria a conta pelo link do login e entra como Cliente", async () => {
    const { usuario, falsa } = abrir({ rota: "/entrar" });
    await usuario.click(await screen.findByRole("link", { name: "Criar conta" }));
    await usuario.type(screen.getByLabelText(/Nome/), "Camila Prado");
    await usuario.type(screen.getByLabelText(/E-mail/), "camila@ciranda.app");
    await usuario.type(screen.getByLabelText(/Senha/), "senha-forte-1");
    await usuario.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText(/Camila/)).toBeInTheDocument();
    expect(screen.getByText(/· Cliente/)).toBeInTheDocument();
    expect(falsa.banco.usuarios.at(-1)).toMatchObject({ email: "camila@ciranda.app", perfil: "Cliente" });
    expect(document.title).toContain("Ciranda");
  });
  it("mostra os erros nos campos e foca o primeiro", async () => {
    const { usuario } = abrir({ rota: "/cadastrar" });
    await usuario.type(await screen.findByLabelText(/Senha/), "123");
    await usuario.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("Mínimo de 8 caracteres.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/Nome/)).toHaveFocus());
  });
  it("avisa quando o e-mail já tem conta", async () => {
    const { usuario } = abrir({ rota: "/cadastrar" });
    await usuario.type(await screen.findByLabelText(/Nome/), "Ana Costa");
    await usuario.type(screen.getByLabelText(/E-mail/), "ana@ciranda.app");
    await usuario.type(screen.getByLabelText(/Senha/), "senha-forte-1");
    await usuario.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe uma conta com esse e-mail.");
  });
  it("quem já está logado vai direto para o sistema", async () => {
    abrir({ rota: "/cadastrar", como: "ana" });
    expect(await screen.findByRole("heading", { name: "Catálogo" })).toBeInTheDocument();
  });
});
