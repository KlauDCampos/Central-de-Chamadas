// Classe de erro padronizada usada em toda a aplicação para garantir
// respostas HTTP consistentes (400, 401, 403, 404, 500...)
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(message, 400, details);
  }
  static unauthorized(message = 'Não autenticado') {
    return new AppError(message, 401);
  }
  static forbidden(message = 'Sem permissão para executar esta ação') {
    return new AppError(message, 403);
  }
  static notFound(message = 'Recurso não encontrado') {
    return new AppError(message, 404);
  }
  static conflict(message: string) {
    return new AppError(message, 409);
  }
  static internal(message = 'Erro interno do servidor') {
    return new AppError(message, 500);
  }
}
