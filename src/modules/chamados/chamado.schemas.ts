import { z } from 'zod';
import { Prioridade } from "../../enums/Prioridade";
import { StatusChamado } from "../../enums/StatusChamado";

export const criarChamadoSchema = z.object({
  body: z.object({
    titulo: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
    descricao: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
    categoria: z.string().optional(),
    prioridade: z.nativeEnum(Prioridade).optional(),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const listarChamadosSchema = z.object({
  body: z.any().optional(),
  params: z.any().optional(),
  query: z.object({
    status: z.nativeEnum(StatusChamado).optional(),
    prioridade: z.nativeEnum(Prioridade).optional(),
    categoria: z.string().optional(),
    pagina: z.coerce.number().int().min(1).optional(),
    tamanhoPagina: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const atualizarStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(StatusChamado),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const atribuirResponsavelSchema = z.object({
  body: z.object({
    responsavelId: z.string().uuid('id de responsável inválido'),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const corrigirClassificacaoSchema = z.object({
  body: z.object({
    categoria: z.string().min(1).optional(),
    prioridade: z.nativeEnum(Prioridade).optional(),
  }).refine((d) => d.categoria || d.prioridade, {
    message: 'Informe ao menos categoria ou prioridade para corrigir',
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});


