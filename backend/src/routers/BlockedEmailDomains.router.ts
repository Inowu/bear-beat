import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { publicProcedure } from '../procedures/public.procedure';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';
import {
  getBlockedEmailDomains,
  isValidDomain,
  normalizeDomainInput,
  RESERVED_EMAIL_DOMAINS,
  setBlockedEmailDomains,
} from '../utils/blockedEmailDomains';

const domainInputSchema = z.object({
  domain: z.string().min(1),
});

export const blockedEmailDomainsRouter = router({
  listBlockedEmailDomains: publicProcedure.query(async ({ ctx }) => {
    const domains = await getBlockedEmailDomains(ctx.prisma);
    return domains;
  }),
  addBlockedEmailDomain: shieldedProcedure
    .input(domainInputSchema)
    .mutation(async ({ ctx, input }) => {
      const domain = normalizeDomainInput(input.domain);

      if (!isValidDomain(domain)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El dominio no tiene un formato valido',
        });
      }

      if (RESERVED_EMAIL_DOMAINS.includes(domain)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No se permite bloquear dominios publicos',
        });
      }

      const currentDomains = await getBlockedEmailDomains(ctx.prisma);

      if (currentDomains.includes(domain)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El dominio ya esta en la lista de bloqueados',
        });
      }

      const updatedDomains = await setBlockedEmailDomains(ctx.prisma, [
        ...currentDomains,
        domain,
      ]);

      return updatedDomains;
    }),
  removeBlockedEmailDomain: shieldedProcedure
    .input(domainInputSchema)
    .mutation(async ({ ctx, input }) => {
      const domain = normalizeDomainInput(input.domain);
      const currentDomains = await getBlockedEmailDomains(ctx.prisma);

      if (!currentDomains.includes(domain)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El dominio no existe en la lista de bloqueados',
        });
      }

      const updatedDomains = await setBlockedEmailDomains(
        ctx.prisma,
        currentDomains.filter((existing) => existing !== domain),
      );

      return updatedDomains;
    }),
});
