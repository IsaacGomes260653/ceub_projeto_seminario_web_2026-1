import { Router } from "express";
import bcrypt from "bcryptjs";
import { conflito, ErroHttp, rota } from "../erros.js";
import { validar } from "../validar.js";

export function rotasAuth(db, auth, limiteLogin) {
  const r = Router();
  const porEmail = db.prepare("SELECT id, senha_hash AS senhaHash, ativo FROM usuarios WHERE email = ?");
  // Hash de comparação usado quando o e-mail não existe, para o tempo de resposta
  // não revelar quais e-mails estão cadastrados.
  const hashFalso = bcrypt.hashSync("senha-inexistente", 8);

  r.post("/login", limiteLogin, rota((req, res) => {
    const { email, senha } = validar(req.body, {
      email: { tipo: "email", obrigatorio: true, max: 120 },
      senha: { tipo: "texto", obrigatorio: true, max: 200 },
    });
    const u = porEmail.get(email);
    const confere = bcrypt.compareSync(senha, u ? u.senhaHash : hashFalso);
    if (!u || !confere || !u.ativo) throw new ErroHttp(401, "E-mail ou senha incorretos.");
    res.json({ token: auth.emitirToken(u.id), usuario: auth.carregar(u.id) });
  }));

  // Cadastro aberto: quem se cadastra entra sempre como Cliente. Perfil nunca vem do formulário.
  r.post("/cadastro", limiteLogin, rota((req, res) => {
    const d = validar(req.body, {
      nome: { tipo: "texto", obrigatorio: true, min: 3, max: 80 },
      email: { tipo: "email", obrigatorio: true, max: 120 },
      senha: { tipo: "texto", obrigatorio: true, min: 8, max: 200 },
    });
    const perfil = db.prepare("SELECT id FROM perfis WHERE nome = 'Cliente'").get();
    if (!perfil) throw new ErroHttp(503, "O cadastro está fechado no momento.");
    if (porEmail.get(d.email)) throw conflito("Já existe uma conta com esse e-mail. Entre com ela.");
    const id = Number(db.prepare("INSERT INTO usuarios (nome, email, senha_hash, perfil_id) VALUES (?, ?, ?, ?)")
      .run(d.nome, d.email, bcrypt.hashSync(d.senha, 10), perfil.id).lastInsertRowid);
    res.status(201).json({ token: auth.emitirToken(id), usuario: auth.carregar(id) });
  }));

  r.get("/eu", auth.autenticar, rota((req, res) => res.json({ usuario: req.usuario })));
  return r;
}
