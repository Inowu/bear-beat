import { shieldedProcedure } from '../../procedures/shielded.procedure';

export const getProducts = shieldedProcedure.query(
  async ({ ctx: { prisma } }) => {
    return prisma.products.findMany();
  },
);
