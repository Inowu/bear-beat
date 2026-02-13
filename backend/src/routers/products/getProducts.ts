import { Prisma } from '@prisma/client';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';

export const getProducts = shieldedProcedure.query(
  async ({ ctx: { prisma } }) => {
    try {
      return await prisma.products.findMany();
    } catch (e: unknown) {
      // Local/dev resilience: some environments can drift (tables created manually in prod but not
      // represented in Prisma migrations). Avoid breaking /micuenta in non-production.
      if (
        process.env.NODE_ENV !== 'production' &&
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2021'
      ) {
        log.warn('[PRODUCTS] Missing products table; returning empty list (non-production).');
        return [];
      }
      throw e;
    }
  },
);
