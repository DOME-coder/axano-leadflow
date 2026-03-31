import { PrismaClient } from '@prisma/client';

const globalFuerPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalFuerPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalFuerPrisma.prisma = prisma;
}
