import { PrismaClient } from '@prisma/client';

// Instância única do Prisma Client (camada de acesso a dados / repository layer usa isso)
export const prisma = new PrismaClient();
