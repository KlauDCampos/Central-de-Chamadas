import {z} from 'zod';

export const criarComentarioSchema = z.object({
  body: z.object({
    texto: z.string().min(1, 'Comentário não pode ser vazio'),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});