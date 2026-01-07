import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { publicProcedure } from '../procedures/public.procedure';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';
import {
  getBlockedPhoneNumbers,
  isValidPhoneNumber,
  normalizePhoneInput,
  setBlockedPhoneNumbers,
} from '../utils/blockedPhoneNumbers';

const phoneInputSchema = z.object({
  phone: z.string().min(1),
});

export const blockedPhoneNumbersRouter = router({
  listBlockedPhoneNumbers: publicProcedure.query(async ({ ctx }) => {
    const numbers = await getBlockedPhoneNumbers(ctx.prisma);
    return numbers;
  }),
  addBlockedPhoneNumber: shieldedProcedure
    .input(phoneInputSchema)
    .mutation(async ({ ctx, input }) => {
      const phone = normalizePhoneInput(input.phone);

      if (!isValidPhoneNumber(phone)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El telefono no tiene un formato valido',
        });
      }

      const currentNumbers = await getBlockedPhoneNumbers(ctx.prisma);

      if (currentNumbers.includes(phone)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El telefono ya esta en la lista de bloqueados',
        });
      }

      const updatedNumbers = await setBlockedPhoneNumbers(ctx.prisma, [
        ...currentNumbers,
        phone,
      ]);

      return updatedNumbers;
    }),
  removeBlockedPhoneNumber: shieldedProcedure
    .input(phoneInputSchema)
    .mutation(async ({ ctx, input }) => {
      const phone = normalizePhoneInput(input.phone);
      const currentNumbers = await getBlockedPhoneNumbers(ctx.prisma);

      if (!currentNumbers.includes(phone)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El telefono no existe en la lista de bloqueados',
        });
      }

      const updatedNumbers = await setBlockedPhoneNumbers(
        ctx.prisma,
        currentNumbers.filter((existing) => existing !== phone),
      );

      return updatedNumbers;
    }),
});
