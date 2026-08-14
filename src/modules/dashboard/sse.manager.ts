import { Response } from 'express';

// Gerenciador simples de conexões Server-Sent Events (SSE).
// Mantém a lista de clientes conectados ao painel de indicadores e permite
// fazer broadcast de eventos (ex.: "chamado criado", "chamado ALTA aberto").
class SseManager {
  private clientes: Response[] = [];

  adicionar(res: Response) {
    this.clientes.push(res);
  }

  remover(res: Response) {
    this.clientes = this.clientes.filter((c) => c !== res);
  }

  broadcast(evento: string, dados: unknown) {
    const payload = `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
    for (const cliente of this.clientes) {
      cliente.write(payload);
    }
  }

  get totalConectados() {
    return this.clientes.length;
  }
}

export const sseManager = new SseManager();
