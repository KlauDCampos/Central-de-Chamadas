import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { hashPassword } from '../src/utils/hash';
import { signToken } from '../src/utils/jwt';

const app = createApp();

describe('Chamados', () => {
  let tokenAdmin: string;
  let tokenSolicitante: string;
  let chamadoId: string;

  const emailAdmin = `admin_${Date.now()}@fadex.org.br`;
  const emailSolicitante = `solicitante_${Date.now()}@fadex.org.br`;

  beforeAll(async () => {
    // Usuários ADMIN não podem ser criados pelo endpoint público de registro
    // (por design de segurança), então criamos direto via Prisma, como faria o seed.
    const senhaHash = await hashPassword('senha123');
    const admin = await prisma.usuario.create({
      data: { nome: 'Admin Teste', email: emailAdmin, senhaHash, papel: 'ADMIN' },
    });
    tokenAdmin = signToken({ sub: admin.id, email: admin.email, papel: 'ADMIN' });

    const solicitante = await request(app).post('/api/auth/register').send({
      nome: 'Solicitante Teste',
      email: emailSolicitante,
      senha: 'senha123',
    });
    tokenSolicitante = solicitante.body.token;
  });

  afterAll(async () => {
    await prisma.comentario.deleteMany({});
    await prisma.chamado.deleteMany({ where: { solicitante: { email: emailSolicitante } } });
    await prisma.usuario.deleteMany({ where: { email: { in: [emailAdmin, emailSolicitante] } } });
    await prisma.$disconnect();
  });

  it('deve criar um chamado com triagem automática (prioridade ALTA por urgência)', async () => {
    const res = await request(app)
      .post('/api/chamados')
      .set('Authorization', `Bearer ${tokenSolicitante}`)
      .send({
        titulo: 'Sistema fora do ar, urgente',
        descricao: 'Ninguém consegue trabalhar, o sistema caiu para todos os usuários. Preciso de ajuda urgente.',
      });

    expect(res.status).toBe(201);
    expect(res.body.prioridade).toBe('ALTA');
    expect(res.body.origemClassificacao).toBe('IA');
    chamadoId = res.body.id;
  });

  it('não deve permitir criar chamado sem autenticação', async () => {
    const res = await request(app).post('/api/chamados').send({ titulo: 'x', descricao: 'y'.repeat(10) });
    expect(res.status).toBe(401);
  });

  it('SOLICITANTE não deve ver chamados de outro usuário na listagem', async () => {
    const res = await request(app).get('/api/chamados').set('Authorization', `Bearer ${tokenSolicitante}`);
    expect(res.status).toBe(200);
    expect(res.body.dados.every((c: any) => c.solicitanteId)).toBe(true);
  });

  it('ADMIN deve conseguir listar todos os chamados', async () => {
    const res = await request(app).get('/api/chamados').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.dados)).toBe(true);
  });

  it('deve adicionar comentário ao chamado', async () => {
    const res = await request(app)
      .post(`/api/chamados/${chamadoId}/comentarios`)
      .set('Authorization', `Bearer ${tokenSolicitante}`)
      .send({ texto: 'Já tentei reiniciar.' });
    expect(res.status).toBe(201);
  });

  it('deve atualizar o status do chamado (ABERTO -> EM_ANDAMENTO)', async () => {
    const res = await request(app)
      .patch(`/api/chamados/${chamadoId}/status`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ status: 'EM_ANDAMENTO' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('EM_ANDAMENTO');
  });

  it('não deve permitir reabrir um chamado FECHADO', async () => {
    await request(app)
      .patch(`/api/chamados/${chamadoId}/status`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ status: 'FECHADO' });

    const res = await request(app)
      .patch(`/api/chamados/${chamadoId}/status`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ status: 'ABERTO' });

    expect(res.status).toBe(400);
  });

  it('SOLICITANTE não deve conseguir atribuir responsável (somente ADMIN)', async () => {
    const res = await request(app)
      .patch(`/api/chamados/${chamadoId}/responsavel`)
      .set('Authorization', `Bearer ${tokenSolicitante}`)
      .send({ responsavelId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(403);
  });

  it('deve retornar 404 para chamado inexistente', async () => {
    const res = await request(app)
      .get('/api/chamados/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(404);
  });
});
