import { prisma } from '../../config/database';
import { Papel } from '../../enums/Papel';

export const userRepository = {
  findByEmail(email: string) {
    return prisma.usuario.findUnique({ where: { email } });
  },
  findById(id: string) {
    return prisma.usuario.findUnique({ where: { id } });
  },
  create(data: { nome: string; email: string; senhaHash: string; papel: Papel }) {
    return prisma.usuario.create({ data });
  },
};
