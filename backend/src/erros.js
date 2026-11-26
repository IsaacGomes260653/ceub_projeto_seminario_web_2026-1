// Erro de aplicação com status HTTP. As rotas lançam, o tratador central responde.
export class ErroHttp extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}
export const naoEncontrado = (oQue) => new ErroHttp(404, `${oQue} não encontrado.`);
export const conflito = (mensagem) => new ErroHttp(409, mensagem);
export const invalido = (detalhes) => new ErroHttp(400, "Dados inválidos.", detalhes);

// Envolve uma rota para que erros caiam no tratador central.
export const rota = (fn) => (req, res, next) => {
  try {
    const r = fn(req, res, next);
    if (r && typeof r.catch === "function") r.catch(next);
  } catch (e) {
    next(e);
  }
};
