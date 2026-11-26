import { Router } from "express";
import { naoEncontrado, rota } from "../erros.js";
import { lerId, validar } from "../validar.js";

export const CATEGORIAS = ["Camisetas e blusas", "Camisas", "Vestidos", "Saias", "Calças jeans", "Jaquetas e casacos", "Calçados", "Bolsas e acessórios"];
export const CONSERVACOES = ["Novo com etiqueta", "Ótimo estado", "Bom estado", "Com marcas de uso"];
export const SITUACOES = ["Disponível", "Reservada", "Vendida"];

const REGRAS = {
  titulo: { tipo: "texto", obrigatorio: true, min: 3, max: 80 },
  marca: { tipo: "texto", max: 40 },
  tamanho: { tipo: "texto", max: 10 },
  categoria: { tipo: "texto", obrigatorio: true, opcoes: CATEGORIAS },
  conservacao: { tipo: "texto", obrigatorio: true, opcoes: CONSERVACOES },
  preco: { tipo: "numero", obrigatorio: true, min: 0.01, max: 100000 },
  voltas: { tipo: "inteiro", min: 1, max: 99 },
  foto: { tipo: "texto", max: 120, padrao: /^[a-z0-9-]+\.(webp|png|jpg)$/, mensagem: "Informe só o nome do arquivo da foto." },
  situacao: { tipo: "texto", opcoes: SITUACOES },
};

export function rotasPecas(db, auth) {
  const r = Router();
  const ver = auth.exigir("catalogo.ver");
  const gerenciar = auth.exigir("pecas.gerenciar");
  const porId = db.prepare("SELECT * FROM pecas WHERE id = ?");
  const buscar = (id) => { const p = porId.get(id); if (!p) throw naoEncontrado("Peça"); return p; };

  // Busca com parâmetros nomeados: o texto digitado nunca é concatenado ao SQL.
  r.get("/", ver, rota((req, res) => {
    const f = validar(req.query, { q: { tipo: "texto", max: 60 }, categoria: { tipo: "texto", opcoes: CATEGORIAS }, situacao: { tipo: "texto", opcoes: SITUACOES } });
    const onde = [], par = {};
    if (f.q) { onde.push("(titulo LIKE @q OR marca LIKE @q)"); par.q = `%${f.q}%`; }
    if (f.categoria) { onde.push("categoria = @categoria"); par.categoria = f.categoria; }
    if (f.situacao) { onde.push("situacao = @situacao"); par.situacao = f.situacao; }
    res.json(db.prepare(`SELECT * FROM pecas ${onde.length ? "WHERE " + onde.join(" AND ") : ""} ORDER BY id DESC`).all(par));
  }));
  r.get("/:id", ver, rota((req, res) => res.json(buscar(lerId(req.params.id)))));

  r.post("/", gerenciar, rota((req, res) => {
    const d = validar(req.body, REGRAS);
    const { lastInsertRowid } = db.prepare(`INSERT INTO pecas (titulo, marca, tamanho, categoria, conservacao, preco, voltas, foto, situacao)
      VALUES (@titulo, @marca, @tamanho, @categoria, @conservacao, @preco, @voltas, @foto, @situacao)`)
      .run({ marca: "", tamanho: "", voltas: 1, foto: "", situacao: "Disponível", ...d });
    res.status(201).json(buscar(Number(lastInsertRowid)));
  }));

  r.put("/:id", gerenciar, rota((req, res) => {
    const atual = buscar(lerId(req.params.id));
    const d = validar(req.body, REGRAS);
    db.prepare(`UPDATE pecas SET titulo=@titulo, marca=@marca, tamanho=@tamanho, categoria=@categoria, conservacao=@conservacao,
      preco=@preco, voltas=@voltas, foto=@foto, situacao=@situacao WHERE id=@id`)
      .run({ marca: "", tamanho: "", voltas: atual.voltas, foto: atual.foto, situacao: atual.situacao, ...d, id: atual.id });
    res.json(buscar(atual.id));
  }));

  r.delete("/:id", gerenciar, rota((req, res) => {
    const atual = buscar(lerId(req.params.id));
    db.prepare("DELETE FROM pecas WHERE id = ?").run(atual.id);
    res.status(204).end();
  }));
  return r;
}
