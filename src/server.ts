import { createApp } from './app';
import { env } from './config/env';

const app = createApp();
// Verificar variáveis de ambiente
console.log('=== DIAGNÓSTICO ===');
console.log('PORT:', env.port);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Definido' : '❌ NÃO DEFINIDO');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('===================');
// Listar todas as rotas registradas (debug)
console.log('\n📋 Rotas registradas:');
app._router.stack.forEach((layer: any) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
    console.log(`${methods} ${layer.route.path}`);
  } else if (layer.name === 'router' && layer.handle.stack) {
    const basePath = layer.regexp.source
      .replace(/\\\//g, '/')
      .replace(/\^/g, '')
      .replace(/\?\(\?=\/\|\$\)/g, '')
      .replace(/\\/g, '');
    if (basePath.includes('auth') || basePath.includes('chamados') || basePath.includes('dashboard')) {
      console.log(`\n📂 Roteador: ${basePath}`);
      layer.handle.stack.forEach((subLayer: any) => {
        if (subLayer.route) {
          const methods = Object.keys(subLayer.route.methods).join(', ').toUpperCase();
          console.log(`  ${methods} ${basePath}${subLayer.route.path}`);
        }
      });
    }
  }
});

app.listen(env.port, () => {
  console.log(`🚀 Helpdesk API rodando em http://localhost:${env.port}`);
  console.log(`📘 Documentação Swagger em http://localhost:${env.port}/docs`);
  console.log(`📊 Painel em tempo real em http://localhost:${env.port}/painel`);
  console.log(`Health: http://localhost:${env.port}/health`);
  console.log(`http://localhost:3000/api/auth/login`);
});
