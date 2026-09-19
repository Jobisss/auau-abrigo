/** Erro com status HTTP — a mensagem vai direto pro usuário, então escreva em português. */
export class HttpError extends Error {
  status: 400 | 401 | 403 | 404 | 413 | 415 | 429

  constructor(status: HttpError['status'], message: string) {
    super(message)
    this.status = status
  }
}
