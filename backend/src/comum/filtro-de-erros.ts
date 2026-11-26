import { ArgumentsHost, Catch, ExceptionFilter, HttpException, NotFoundException } from "@nestjs/common";
import type { Response } from "express";
import { ErroHttp } from "./erros.js";

// Filtro global: toda resposta de erro sai no mesmo formato, { erro, detalhes }, com o status HTTP certo.
// Erro inesperado vira 500 com mensagem genérica. O detalhe fica só no log do servidor, nunca na resposta.
@Catch()
export class FiltroDeErros implements ExceptionFilter {
  catch(erro: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (erro instanceof ErroHttp) return res.status(erro.status).json({ erro: erro.message, detalhes: erro.detalhes });
    if (erro instanceof NotFoundException) return res.status(404).json({ erro: "Rota não encontrada." });
    if (erro instanceof HttpException) return res.status(erro.getStatus()).json({ erro: erro.message });
    console.error(erro);
    return res.status(500).json({ erro: "Erro interno." });
  }
}
