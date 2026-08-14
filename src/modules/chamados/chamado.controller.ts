import { Request, Response, NextFunction } from 'express';
import { chamadoService } from './chamado.service';
import { AppError } from '../../utils/AppError';

export const chamadoController = {
  async criar(req: Request, res: Response, next: NextFunction) {
    try {
      const chamado = await chamadoService.criar(req.user!, req.body);
      res.status(201).json(chamado);
    } catch (err) {
      next(err);
    }
  },

  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, prioridade, categoria, pagina, tamanhoPagina } = req.query as Record<string, string>;
      const resultado = await chamadoService.listar(req.user!, {
        status: status as any,
        prioridade: prioridade as any,
        categoria,
        pagina: pagina ? Number(pagina) : undefined,
        tamanhoPagina: tamanhoPagina ? Number(tamanhoPagina) : undefined,
      });
      res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  },

  async buscarPorId(req: Request, res: Response, next: NextFunction) {
    try {
      const chamado = await chamadoService.buscarPorId(req.user!, req.params.id);
      res.status(200).json(chamado);
    } catch (err) {
      next(err);
    }
  },

  async atualizarStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const chamado = await chamadoService.atualizarStatus(req.user!, req.params.id, req.body.status);
      res.status(200).json(chamado);
    } catch (err) {
      next(err);
    }
  },

  async atribuirResponsavel(req: Request, res: Response, next: NextFunction) {
    try {
      const chamado = await chamadoService.atribuirResponsavel(req.user!, req.params.id, req.body.responsavelId);
      res.status(200).json(chamado);
    } catch (err) {
      next(err);
    }
  },

  async corrigirClassificacao(req: Request, res: Response, next: NextFunction) {
    try {
      const chamado = await chamadoService.corrigirClassificacao(req.user!, req.params.id, req.body);
      res.status(200).json(chamado);
    } catch (err) {
      next(err);
    }
  },

  async remover(req: Request, res: Response, next: NextFunction) {
    try {
      await chamadoService.remover(req.user!, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async adicionarComentario(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.body.texto) throw AppError.badRequest('Campo "texto" é obrigatório');
      const comentario = await chamadoService.adicionarComentario(req.user!, req.params.id, req.body.texto);
      res.status(201).json(comentario);
    } catch (err) {
      next(err);
    }
  },
};
