import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';

const app = createApp();

describe('Autenticação', () => {
  const usuario = {
    nome: 'Usuário Teste',
    email: `teste_${Date.now()}@fadex.org.br`,
    senha: 'senha123',
  };

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: usuario.email } });
    await prisma.$disconnect();
  });

  it('deve registrar um novo usuário e retornar token', async () => {
    const res = await request(app).post('/api/auth/register').send(usuario);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario.email).toBe(usuario.email);
    expect(res.body.usuario.papel).toBe('SOLICITANTE');
  });

  it('não deve permitir e-mail duplicado', async () => {
    const res = await request(app).post('/api/auth/register').send(usuario);
    expect(res.status).toBe(409);
  });

  it('deve fazer login com credenciais válidas', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: usuario.email, senha: usuario.senha });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('deve rejeitar login com senha errada', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: usuario.email, senha: 'errada' });
    expect(res.status).toBe(401);
  });

  it('cadastro público deve sempre criar papel SOLICITANTE, mesmo se "papel" for enviado', async () => {
    const email = `tentativa_admin_${Date.now()}@fadex.org.br`;
    const res = await request(app).post('/api/auth/register').send({
      nome: 'Tentando ser admin',
      email,
      senha: 'senha123',
      papel: 'ADMIN',
    });
    expect(res.status).toBe(201);
    expect(res.body.usuario.papel).toBe('SOLICITANTE');
    await prisma.usuario.deleteMany({ where: { email } });
  });

  it('deve rejeitar payload inválido no registro', async () => {
    const res = await request(app).post('/api/auth/register').send({ nome: 'A', email: 'invalido', senha: '1' });
    expect(res.status).toBe(400);
  });
});
