import { Router } from "express";
import bcrypt from "bcryptjs";
import { ErroHttp, rota } from "../erros.js";
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

  r.get("/eu", auth.autenticar, rota((req, res) => res.json({ usuario: req.usuario })));
  return r;
}
