import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
 
import authRoutes from './modules/auth/auth.routes';
import chamadoRoutes from './modules/chamados/chamado.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';
 
export function createApp() {
  const app = express();
 
  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));
 
  // Painel HTML simples que consome o endpoint SSE de indicadores em tempo real
  // (diferencial do item 3.2 — interface web simples exibindo o painel em tempo real).
  app.use('/painel', express.static(path.join(__dirname, '..', 'public')));
 
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
 
  // Documentação interativa da API (Swagger/OpenAPI — diferencial do item 3.2)
  try {
    const openapiFilePath = path.join(__dirname, 'docs', 'openapi.yaml');
    const openapiDocument = YAML.load(openapiFilePath);
 
    app.use(
      '/docs',
      swaggerUi.serve,
      swaggerUi.setup(openapiDocument, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Helpdesk API - Documentação',
      }),
    );
 
    console.log('------ Documentação Swagger disponível em /docs ------');
  } catch (error) {
    console.error('❌ Erro ao configurar documentação:', error);
    // Rota de fallback: garante que /docs sempre responda algo, mesmo se o
    // openapi.yaml não puder ser carregado (não deve derrubar a API por isso).
    app.get('/docs', (_req, res) => {
      res.status(200).send(`
        <h1>📚 Documentação da API</h1>
        <p>Não foi possível carregar o openapi.yaml.</p>
      `);
    });
  }
 
  app.use('/api/auth', authRoutes);
  app.use('/api/chamados', chamadoRoutes);
  app.use('/api/dashboard', dashboardRoutes);
 
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
 
  return app;
}
 