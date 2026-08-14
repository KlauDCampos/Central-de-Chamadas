import { prisma } from '../../config/database';
import { StatusChamado } from '../../enums/StatusChamado';
import {Prioridade} from '../../enums/Prioridade'

export const dashboardService = {
  // Contagem de chamados agrupada por status e por prioridade — usada tanto
  // pelo endpoint REST quanto pelo snapshot inicial enviado via SSE.
  async obterIndicadores() {
    const [porStatus, porPrioridade, total, abertosAlta] = await Promise.all([
      prisma.chamado.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.chamado.groupBy({ by: ['prioridade'], _count: { _all: true } }),
      prisma.chamado.count(),
      prisma.chamado.count({ where: { prioridade: 'ALTA', status: { in: ['ABERTO', 'EM_ANDAMENTO'] } } }),
    ]);

    const status = { ABERTO: 0, EM_ANDAMENTO: 0, RESOLVIDO: 0, FECHADO: 0 } as Record<string, number>;
    porStatus.forEach((s: { status: StatusChamado; _count: { _all: number } }) => {
      status[s.status] = s._count._all;
    });

    const prioridade = { BAIXA: 0, MEDIA: 0, ALTA: 0 } as Record<string, number>;
    porPrioridade.forEach((p: { prioridade: Prioridade; _count: { _all: number } }) => {
      prioridade[p.prioridade] = p._count._all;
    });

    return {
      total,
      porStatus: status,
      porPrioridade: prioridade,
      alertaChamadosAltaAbertos: abertosAlta,
      atualizadoEm: new Date().toISOString(),
    };
  },
};
