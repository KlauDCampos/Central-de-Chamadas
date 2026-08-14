import { PrismaClient} from '@prisma/client';
import {Papel} from '../src/enums/Papel'
import {Prioridade} from '../src/enums/Prioridade'
import { OrigemClassificacao } from '../src/enums/OrigemClassificacao';
import { StatusChamado } from '../src/enums/StatusChamado';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const senhaAdmin = await bcrypt.hash('admin123', 10);
  const senhaSolicitante = await bcrypt.hash('solicitante123', 10);

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@fadex.org.br' },
    update: {},
    create: {
      nome: 'Administrador Fadex',
      email: 'admin@fadex.org.br',
      senhaHash: senhaAdmin,
      papel: Papel.ADMIN,
    },
  });

  const solicitante = await prisma.usuario.upsert({
    where: { email: 'solicitante@fadex.org.br' },
    update: {},
    create: {
      nome: 'Colaborador Solicitante',
      email: 'solicitante@fadex.org.br',
      senhaHash: senhaSolicitante,
      papel: Papel.SOLICITANTE,
    },
  });

  const existente = await prisma.chamado.findFirst({ where: { solicitanteId: solicitante.id } });

  if (!existente) {
    const chamado = await prisma.chamado.create({
      data: {
        titulo: 'Não consigo acessar o sistema, urgente',
        descricao:
          'Estou tentando fazer login desde cedo e o sistema não deixa. Preciso disso resolvido com urgência pois não consigo trabalhar.',
        categoria: 'Acesso/Senha',
        prioridade: Prioridade.ALTA,
        status: StatusChamado.ABERTO,
        origemClassificacao: OrigemClassificacao.IA,
        solicitanteId: solicitante.id,
      },
    });

    await prisma.comentario.create({
      data: {
        texto: 'Chamado criado e classificado automaticamente pela IA (heurística).',
        chamadoId: chamado.id,
        autorId: solicitante.id,
      },
    });
  }

  console.log('Seed concluído com sucesso.');
  console.log('----------------------------------------');
  console.log('Usuário ADMIN:       admin@fadex.org.br / admin123');
  console.log('Usuário SOLICITANTE: solicitante@fadex.org.br / solicitante123');
  console.log('----------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
