import jwt from "jsonwebtoken";
import { ErroHttp } from "./erros.js";

export function criarAuth(db, config) {
  const buscarUsuario = db.prepare(`
    SELECT u.id, u.nome, u.email, u.ativo, u.perfil_id AS perfilId, p.nome AS perfil
    FROM usuarios u JOIN perfis p ON p.id = u.perfil_id WHERE u.id = ?`);
  const buscarChaves = db.prepare(`
    SELECT f.chave FROM perfil_funcionalidades pf
    JOIN funcionalidades f ON f.id = pf.funcionalidade_id WHERE pf.perfil_id = ?`);

  // Monta o usuário da sessão sempre a partir do banco, nunca só do token.
  // Assim, desativar alguém ou mudar um perfil vale na requisição seguinte.
  function carregar(id) {
    const u = buscarUsuario.get(id);
    if (!u || !u.ativo) return null;
    return { id: u.id, nome: u.nome, email: u.email, perfilId: u.perfilId, perfil: u.perfil, funcionalidades: buscarChaves.all(u.perfilId).map((f) => f.chave) };
  }

  const emitirToken = (usuarioId) => jwt.sign({ sub: String(usuarioId) }, config.jwtSegredo, { expiresIn: config.tokenExpiraEm, algorithm: "HS256" });

  function autenticar(req, _res, next) {
    const cabecalho = req.get("authorization") || "";
    const [tipo, token] = cabecalho.split(" ");
    if (tipo !== "Bearer" || !token) return next(new ErroHttp(401, "Token de acesso ausente."));
    let dados;
    try {
      dados = jwt.verify(token, config.jwtSegredo, { algorithms: ["HS256"] });
    } catch (e) {
      return next(new ErroHttp(401, e.name === "TokenExpiredError" ? "Sessão expirada. Entre de novo." : "Token de acesso inválido."));
    }
    const usuario = carregar(Number(dados.sub));
    if (!usuario) return next(new ErroHttp(401, "Usuário inativo ou removido."));
    req.usuario = usuario;
    next();
  }

  // Autorização por funcionalidade: o perfil do usuário precisa ter a chave pedida.
  const exigir = (chave) => (req, _res, next) => {
    if (!req.usuario.funcionalidades.includes(chave)) return next(new ErroHttp(403, "Seu perfil não tem acesso a esta funcionalidade."));
    next();
  };

  return { carregar, emitirToken, autenticar, exigir };
}
