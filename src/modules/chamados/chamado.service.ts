
import { Prioridade } from '../../enums/Prioridade';
import { StatusChamado } from '../../enums/StatusChamado';
import { OrigemClassificacao } from '../../enums/OrigemClassificacao';
import { chamadoRepository, FiltrosChamado } from './chamado.repository';
import { userRepository } from '../users/user.repository';
import { triagemService } from '../triagem/triagem.service';
import { AppError } from '../../utils/AppError';
import { TokenPayload } from '../../utils/jwt';
import { sseManager } from '../dashboard/sse.manager';
import { dashboardService } from '../dashboard/dashboard.service';

// Transições de status permitidas
const TRANSICOES_PERMITIDAS: Record<StatusChamado, StatusChamado[]> = {
  ABERTO: [StatusChamado.EM_ANDAMENTO, StatusChamado.CONCLUIDO, StatusChamado.FECHADO],
  EM_ANDAMENTO: [StatusChamado.ABERTO, StatusChamado.CONCLUIDO, StatusChamado.FECHADO],
  CONCLUIDO: [StatusChamado.EM_ANDAMENTO, StatusChamado.FECHADO],
  FECHADO: [], // não pode ser reaberto
};

async function emitirAtualizacaoIndicadores() {
  const indicadores = await dashboardService.obterIndicadores();
  sseManager.broadcast('indicadores', indicadores);
}

function garantirAcessoAoChamado(usuario: TokenPayload, solicitanteId: string) {
  if (usuario.papel === 'ADMIN') return;
  if (usuario.sub !== solicitanteId) {
    throw AppError.forbidden('Você só pode acessar chamados que você mesmo abriu');
  }
}

export const chamadoService = {
  async criar(usuario: TokenPayload, input: { titulo: string; descricao: string; categoria?: string; prioridade?: Prioridade }) {
    let categoria = input.categoria;
    let prioridade = input.prioridade;
    let origem: OrigemClassificacao = OrigemClassificacao.MANUAL;

    // Se o solicitante não informou categoria/prioridade manualmente, a IA classifica.
    if (!categoria || !prioridade) {
      const sugestao = await triagemService.classificar(input.titulo, input.descricao);
      categoria = categoria ?? sugestao.categoria;
      prioridade = prioridade ?? sugestao.prioridade;
      origem = OrigemClassificacao.IA;
    }

    const chamado = await chamadoRepository.create({
      titulo: input.titulo,
      descricao: input.descricao,
      categoria,
      prioridade,
      origemClassificacao: origem,
      solicitanteId: usuario.sub,
    });

    // Histórico automático de criação
    await chamadoRepository.addComentario(
      chamado.id,
      usuario.sub,
      `Chamado criado. Classificação (${origem === 'IA' ? 'sugerida pela IA' : 'manual'}): categoria "${categoria}", prioridade "${prioridade}".`,
    );

    await emitirAtualizacaoIndicadores();
    if (prioridade === 'ALTA') {
      sseManager.broadcast('alerta-prioridade-alta', {
        chamadoId: chamado.id,
        titulo: chamado.titulo,
        mensagem: `Novo chamado de prioridade ALTA aberto: "${chamado.titulo}"`,
      });
    }

    return chamadoRepository.findById(chamado.id);
  },

  async listar(usuario: TokenPayload, filtros: FiltrosChamado) {
    // SOLICITANTE só enxerga os próprios chamados; ADMIN enxerga tudo.
    const filtrosFinais: FiltrosChamado =
      usuario.papel === 'ADMIN' ? filtros : { ...filtros, solicitanteId: usuario.sub };

    return chamadoRepository.findMany(filtrosFinais);
  },

  async buscarPorId(usuario: TokenPayload, id: string) {
    const chamado = await chamadoRepository.findById(id);
    if (!chamado) throw AppError.notFound('Chamado não encontrado');
    garantirAcessoAoChamado(usuario, chamado.solicitanteId);
    return chamado;
  },

  async atualizarStatus(usuario: TokenPayload, id: string, novoStatus: StatusChamado) {
    const chamado = await chamadoRepository.findById(id);
    if (!chamado) throw AppError.notFound('Chamado não encontrado');
    garantirAcessoAoChamado(usuario, chamado.solicitanteId);

    if (chamado.status === novoStatus) {
      return chamado; 
    }

    const permitido = TRANSICOES_PERMITIDAS[chamado.status as keyof typeof TRANSICOES_PERMITIDAS].includes(novoStatus);
    if (!permitido) {
      throw AppError.badRequest(
        `Transição de status inválida: não é possível mudar de "${chamado.status}" para "${novoStatus}"` +
          (chamado.status === 'FECHADO' ? ' (chamados fechados não podem ser reabertos)' : ''),
      );
    }

    const atualizado = await chamadoRepository.updateStatus(id, novoStatus);
    await chamadoRepository.addComentario(id, usuario.sub, `Status alterado de "${chamado.status}" para "${novoStatus}".`);
    await emitirAtualizacaoIndicadores();

    return atualizado;
  },

  async atribuirResponsavel(usuario: TokenPayload, id: string, responsavelId: string) {
    // Regra explícita do edital: apenas ADMIN pode reatribuir responsáveis.
    if (usuario.papel !== 'ADMIN') {
      throw AppError.forbidden('Apenas administradores podem atribuir responsáveis');
    }

    const chamado = await chamadoRepository.findById(id);
    if (!chamado) throw AppError.notFound('Chamado não encontrado');

    const responsavel = await userRepository.findById(responsavelId);
    if (!responsavel) throw AppError.badRequest('Responsável informado não existe');

    const atualizado = await chamadoRepository.updateResponsavel(id, responsavelId);
    await chamadoRepository.addComentario(id, usuario.sub, `Responsável atribuído: ${responsavel.nome}.`);

    return atualizado;
  },

  async corrigirClassificacao(usuario: TokenPayload, id: string, dados: { categoria?: string; prioridade?: Prioridade }) {
    // Regra do edital: "O ADMIN pode aceitar ou corrigir a sugestão" da IA.
    if (usuario.papel !== 'ADMIN') {
      throw AppError.forbidden('Apenas administradores podem corrigir a classificação de um chamado');
    }

    const chamado = await chamadoRepository.findById(id);
    if (!chamado) throw AppError.notFound('Chamado não encontrado');

    const atualizado = await chamadoRepository.updateClassificacao(id, dados);
    await chamadoRepository.addComentario(
      id,
      usuario.sub,
      `Classificação corrigida manualmente por administrador: ${dados.categoria ? `categoria -> "${dados.categoria}" ` : ''}${dados.prioridade ? `prioridade -> "${dados.prioridade}"` : ''}`.trim(),
    );
    await emitirAtualizacaoIndicadores();

    return atualizado;
  },

  async remover(usuario: TokenPayload, id: string) {
    const chamado = await chamadoRepository.findById(id);
    if (!chamado) throw AppError.notFound('Chamado não encontrado');
    garantirAcessoAoChamado(usuario, chamado.solicitanteId);

    // SOLICITANTE só pode excluir/cancelar chamados que ainda não entraram em atendimento.
    if (usuario.papel !== 'ADMIN' && chamado.status !== 'ABERTO') {
      throw AppError.forbidden('Só é possível excluir chamados com status ABERTO');
    }

    await chamadoRepository.delete(id);
    await emitirAtualizacaoIndicadores();
  },

  async adicionarComentario(usuario: TokenPayload, id: string, texto: string) {
    const chamado = await chamadoRepository.findById(id);
    if (!chamado) throw AppError.notFound('Chamado não encontrado');
    garantirAcessoAoChamado(usuario, chamado.solicitanteId);

    return chamadoRepository.addComentario(id, usuario.sub, texto);
  },
};
