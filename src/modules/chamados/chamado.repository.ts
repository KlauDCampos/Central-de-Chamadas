import { Prisma, Prioridade, StatusChamado, OrigemClassificacao } from '@prisma/client';
import { prisma } from '../../config/database';

export interface FiltrosChamado {
  status?: StatusChamado;
  prioridade?: Prioridade;
  categoria?: string;
  solicitanteId?: string; // usado para restringir SOLICITANTE aos próprios chamados
  pagina?: number;
  tamanhoPagina?: number;
}

const INCLUDE_PADRAO = {
  solicitante: { select: { id: true, nome: true, email: true } },
  responsavel: { select: { id: true, nome: true, email: true } },
  comentarios: {
    orderBy: { createdAt: 'asc' as const },
    include: { autor: { select: { id: true, nome: true, email: true } } },
  },
} satisfies Prisma.ChamadoInclude;

export const chamadoRepository = {
  create(data: {
    titulo: string;
    descricao: string;
    categoria: string;
    prioridade: Prioridade;
    origemClassificacao: OrigemClassificacao;
    solicitanteId: string;
  }) {
    return prisma.chamado.create({ data, include: INCLUDE_PADRAO });
  },

  findById(id: string) {
    return prisma.chamado.findUnique({ where: { id }, include: INCLUDE_PADRAO });
  },

  async findMany(filtros: FiltrosChamado) {
    const where: Prisma.ChamadoWhereInput = {
      status: filtros.status,
      prioridade: filtros.prioridade,
      categoria: filtros.categoria,
      solicitanteId: filtros.solicitanteId,
    };

    const pagina = filtros.pagina ?? 1;
    const tamanhoPagina = filtros.tamanhoPagina ?? 20;

    const [dados, total] = await Promise.all([
      prisma.chamado.findMany({
        where,
        include: INCLUDE_PADRAO,
        orderBy: { createdAt: 'desc' },
        skip: (pagina - 1) * tamanhoPagina,
        take: tamanhoPagina,
      }),
      prisma.chamado.count({ where }),
    ]);

    return { dados, total, pagina, tamanhoPagina };
  },

  updateStatus(id: string, status: StatusChamado) {
    return prisma.chamado.update({ where: { id }, data: { status }, include: INCLUDE_PADRAO });
  },

  updateResponsavel(id: string, responsavelId: string) {
    return prisma.chamado.update({ where: { id }, data: { responsavelId }, include: INCLUDE_PADRAO });
  },

  updateClassificacao(id: string, data: { categoria?: string; prioridade?: Prioridade }) {
    return prisma.chamado.update({
      where: { id },
      data: { ...data, origemClassificacao: OrigemClassificacao.MANUAL },
      include: INCLUDE_PADRAO,
    });
  },

  delete(id: string) {
    return prisma.chamado.delete({ where: { id } });
  },

  addComentario(chamadoId: string, autorId: string, texto: string) {
    return prisma.comentario.create({
      data: { chamadoId, autorId, texto },
      include: { autor: { select: { id: true, nome: true, email: true } } },
    });
  },
};
