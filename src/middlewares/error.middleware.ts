import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';


export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      erro: err.message,
      detalhes: err.details,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      erro: 'Dados inválidos',
      detalhes: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
    });
  }

  // Erros de constraint única do Prisma (ex.: e-mail duplicado)
  if (typeof err === 'object' && err !== null && 'code' in err && (err as any).code === 'P2002') {
    return res.status(409).json({ erro: 'Registro já existe (violação de unicidade)' });
  }

  console.error('Erro não tratado:', err);
  return res.status(500).json({ erro: 'Erro interno do servidor' });
}

export function notFoundMiddleware(_req: Request, res: Response) {
  res.status(404).json({ erro: 'Rota não encontrada' });
}
