// Erro de aplicação com status HTTP. Os serviços lançam, o filtro global responde.
export class ErroHttp extends Error {
  constructor(public readonly status: number, mensagem: string, public readonly detalhes?: Record<string, string>) {
    super(mensagem);
  }
}
export const naoEncontrado = (oQue: string) => new ErroHttp(404, `${oQue} não encontrado.`);
export const conflito = (mensagem: string) => new ErroHttp(409, mensagem);
export const invalido = (detalhes: Record<string, string>) => new ErroHttp(400, "Dados inválidos.", detalhes);
export const semAcesso = () => new ErroHttp(403, "Seu perfil não tem acesso a esta funcionalidade.");
