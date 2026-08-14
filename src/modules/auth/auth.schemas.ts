import { z } from 'zod';

// Observação de segurança: o cadastro público NUNCA aceita "papel" como ADMIN.
// Todo usuário criado por este endpoint é sempre SOLICITANTE. Usuários ADMIN
// são provisionados apenas via seed/migration (ver prisma/seed.ts), evitando
// que qualquer pessoa se autopromova a administrador pela API pública.
export const registerSchema = z.object({
  body: z.object({
    nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('E-mail inválido'),
    senha: z.string().min(1, 'Senha é obrigatória'),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});
