import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';
import { sseManager } from './sse.manager';

export const dashboardController = {
  async indicadores(_req: Request, res: Response, next: NextFunction) {
    try {
      const dados = await dashboardService.obterIndicadores();
      res.status(200).json(dados);
    } catch (err) {
      next(err);
    }
  },

  // Endpoint de Server-Sent Events: mantém conexão aberta e empurra atualizações
  // automaticamente sempre que um chamado é criado/alterado (ver chamado.service).
  async stream(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseManager.adicionar(res);

    const snapshot = await dashboardService.obterIndicadores();
    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);

    // keep-alive para evitar timeout de proxies/navegadores
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseManager.remover(res);
    });
  },
};
