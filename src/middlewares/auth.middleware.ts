import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { verifyToken, TokenPayload } from '../utils/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

// Exige um token JWT válido no header Authorization: Bearer <token>.
// Também aceita ?token=... na query string, especificamente para o endpoint
// de SSE (GET /api/dashboard/stream), já que o EventSource nativo do
// navegador não permite enviar headers customizados.
export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length);
  } else if (typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    throw AppError.unauthorized('Token de autenticação ausente');
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    throw AppError.unauthorized('Token inválido ou expirado');
  }
}

// Restringe o acesso a determinados papéis (ex.: apenas ADMIN)
export function requireRole(...roles: Array<'ADMIN' | 'SOLICITANTE'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.papel)) {
      throw AppError.forbidden('Você não tem permissão para executar esta ação');
    }
    next();
  };
}
