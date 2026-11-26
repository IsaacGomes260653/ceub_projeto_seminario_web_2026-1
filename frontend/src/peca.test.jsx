import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { esquecer3D } from "./arara.js";
import { abrir } from "./teste/apoio.jsx";

const comBlusa = (banco) => { banco.pecas.push({ id: 7, titulo: "Camiseta verde", marca: "Insecta", tamanho: "G", categoria: "Camisetas e blusas", conservacao: "Ótimo estado", preco: 24.9, voltas: 1, foto: "camiseta-verde.webp", situacao: "Disponível" }); };

beforeEach(() => { esquecer3D(); delete window.Ciranda3D; document.head.innerHTML = ""; });
afterEach(() => { delete window.Ciranda3D; });

describe("página da peça", () => {
  it("abre pelo cartão do catálogo e mostra os dados da peça", async () => {
    const { usuario } = abrir({ rota: "/catalogo?categoria=Cal%C3%A7as+jeans", como: "ana" });
    await usuario.click(await screen.findByRole("link", { name: "Calça jeans reta" }));
    expect(await screen.findByRole("heading", { name: "Calça jeans reta", level: 1 })).toBeInTheDocument();
    expect(document.title).toBe("Calça jeans reta · Ciranda");
    expect(screen.getByText(/119,90/)).toBeInTheDocument();
    expect(screen.getByText("3ª volta.")).toBeInTheDocument();
    expect(screen.getByText(/já passou por 2 armários/)).toBeInTheDocument();
    expect(within(screen.getByText("Marca").closest("div")).getByText("Levi's")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Calça jeans reta" })).toHaveAttribute("src", "/fotos/calca-jeans.webp");
    // o Voltar devolve a mesma lista filtrada
    await usuario.click(screen.getByRole("link", { name: /Voltar ao catálogo/ }));
    expect(await screen.findByText("1 peça encontrada")).toBeInTheDocument();
    expect(screen.getByLabelText("Categoria")).toHaveValue("Calças jeans");
  });

  it("mostra a água e o carbono poupados quando a categoria tem estimativa", async () => {
    abrir({ rota: "/catalogo/1", como: "ana" });
    const bloco = (await screen.findByRole("heading", { name: "O que esta volta poupa" })).closest("section");
    expect(within(bloco).getByText("2.911 L")).toBeInTheDocument();
    expect(within(bloco).getByText("21,0 kg")).toBeInTheDocument();
    expect(within(bloco).getByText(/calça 501/)).toBeInTheDocument();
  });

  it("não inventa número para categoria sem estimativa", async () => {
    abrir({ rota: "/catalogo/2", como: "ana", preparar: (banco) => { banco.pecas[1].categoria = "Calçados"; } });
    await screen.findByRole("heading", { name: "Vestido midi floral" });
    expect(screen.queryByRole("heading", { name: "O que esta volta poupa" })).toBeNull();
  });

  it("mostra a peça sem foto e a primeira volta", async () => {
    abrir({ rota: "/catalogo/2", como: "ana", preparar: (banco) => { banco.pecas[1].voltas = 1; } });
    expect(await screen.findByRole("heading", { name: "Vestido midi floral" })).toBeInTheDocument();
    expect(screen.getByText("Esta peça ainda não tem foto.")).toBeInTheDocument();
    expect(screen.getByText(/primeira volta pelo brechó/)).toBeInTheDocument();
    expect(screen.getByText("Reservada")).toBeInTheDocument();
  });

  it("diz um armário, no singular, na segunda volta", async () => {
    abrir({ rota: "/catalogo/2", como: "ana", preparar: (banco) => { banco.pecas[1].voltas = 2; } });
    expect(await screen.findByText(/já passou por 1 armário antes/)).toBeInTheDocument();
  });

  it("avisa quando a peça não existe e oferece o caminho de volta", async () => {
    abrir({ rota: "/catalogo/999", como: "ana" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta peça não existe mais no catálogo.");
    expect(screen.getByRole("link", { name: "Voltar ao catálogo" })).toHaveAttribute("href", "/catalogo");
  });

  it("mostra o erro do servidor quando a busca falha por outro motivo", async () => {
    const { falsa } = abrir({ rota: "/catalogo", como: "ana" });
    await screen.findByText("2 peças encontradas");
    const original = falsa.buscar.getMockImplementation();
    falsa.buscar.mockImplementation((url, o) => (String(url).includes("/pecas/1") ? Promise.reject(new TypeError("sem rede")) : original(url, o)));
    screen.getByRole("link", { name: "Calça jeans reta" }).click();
    expect(await screen.findByRole("alert")).toHaveTextContent(/conexão/);
  });

  it("gira a peça em 3D quando o aparelho permite e desliga o visor ao sair", async () => {
    const destruir = vi.fn();
    const visor = vi.fn(() => ({ destruir }));
    window.Ciranda3D = { disponivel: () => true, visor };
    const { unmount } = abrir({ rota: "/catalogo/7", como: "ana", preparar: comBlusa });
    await screen.findByRole("heading", { name: "Camiseta verde" });
    await waitFor(() => expect(visor).toHaveBeenCalledTimes(1));
    expect(visor.mock.calls[0][1]).toEqual({ forma: "top", top: { kind: "tee", colour: "#7C8A6A" }, cor: "" });
    expect(await screen.findByText("Arraste para girar")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Camiseta verde em 3D/ })).toHaveAttribute("tabindex", "0");
    unmount();
    expect(destruir).toHaveBeenCalled();
  });

  it("fica com a foto quando não há 3D ou quando o visor falha", async () => {
    window.Ciranda3D = { disponivel: () => true, visor: () => { throw new Error("contexto perdido"); } };
    abrir({ rota: "/catalogo/7", como: "ana", preparar: comBlusa });
    expect(await screen.findByRole("img", { name: "Camiseta verde" })).toHaveAttribute("src", "/fotos/camiseta-verde.webp");
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Arraste para girar")).toBeNull();
  });

  it("não gira quando o visor não devolve nada", async () => {
    window.Ciranda3D = { disponivel: () => true, visor: () => null };
    abrir({ rota: "/catalogo/7", como: "ana", preparar: comBlusa });
    await screen.findByRole("heading", { name: "Camiseta verde" });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Arraste para girar")).toBeNull();
  });
});
