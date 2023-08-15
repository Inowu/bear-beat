import { PrismaClient } from '@prisma/client';

declare namespace global {
  let prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
