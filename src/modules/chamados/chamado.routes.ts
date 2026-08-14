import { Router } from 'express';
import { chamadoController } from './chamado.controller';
import { authMiddleware, requireRole } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  criarChamadoSchema,
  listarChamadosSchema,
  atualizarStatusSchema,
  atribuirResponsavelSchema,
  corrigirClassificacaoSchema,
  criarComentarioSchema,
} from './chamado.schemas';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(criarChamadoSchema), chamadoController.criar);
router.get('/', validate(listarChamadosSchema), chamadoController.listar);
router.get('/:id', chamadoController.buscarPorId);
router.patch('/:id/status', validate(atualizarStatusSchema), chamadoController.atualizarStatus);
router.patch('/:id/responsavel', requireRole('ADMIN'), validate(atribuirResponsavelSchema), chamadoController.atribuirResponsavel);
router.patch('/:id/classificacao', requireRole('ADMIN'), validate(corrigirClassificacaoSchema), chamadoController.corrigirClassificacao);
router.delete('/:id', chamadoController.remover);

router.post('/:id/comentarios', validate(criarComentarioSchema), chamadoController.adicionarComentario);

export default router;
