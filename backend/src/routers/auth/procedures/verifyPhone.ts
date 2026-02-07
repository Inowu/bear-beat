import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { log } from '../../../server';
import { twilio } from '../../../twilio';
import * as TwilioLib from 'twilio';
import { PrismaClient } from '@prisma/client';
import {
  getBlockedPhoneNumbers,
  normalizePhoneNumber,
  setBlockedPhoneNumbers,
} from '../../../utils/blockedPhoneNumbers';

const { RestException } = TwilioLib;
const TWILIO_BLOCKED_ERROR_CODE = 63024;

const addPhoneToBlockedList = async (
  prisma: PrismaClient,
  phoneNumber: string,
) => {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) {
    return;
  }

  const currentNumbers = await getBlockedPhoneNumbers(prisma);
  if (currentNumbers.includes(normalized)) {
    return;
  }

  await setBlockedPhoneNumbers(prisma, [...currentNumbers, normalized]);
};

export const verifyPhone = shieldedProcedure
  .input(
    z.object({
      code: z
        .string()
        .min(6, { message: 'El codigo debe tener al menos 6 caracteres' }),
      phoneNumber: z.string(),
    }),
  )
  .mutation(
    async ({ input: { code, phoneNumber }, ctx: { prisma, session } }) => {
      const sessionUser = session?.user;
      if (!sessionUser?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No autorizado',
        });
      }

      const existingUser = await prisma.users.findFirst({
        where: {
          id: {
            equals: sessionUser.id,
          },
        },
      });

      if (!existingUser) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No se encuentra el usuario con ese ID',
        });
      }

      if (phoneNumber !== existingUser.phone) {
        await prisma.users.update({
          where: {
            id: sessionUser.id,
          },
          data: {
            phone: phoneNumber,
          },
        });
      }

      try {
        const verificationCode = await twilio.verifyCode(phoneNumber, code);

        if (verificationCode) {
          log.info('[VERIFY_PHONE] Phone was successfully verified');
          await prisma.users.update({
            where: {
              id: sessionUser.id,
            },
            data: {
              verified: true,
            },
          });

          return {
            success: true,
            message: 'El telefono ha sido verificado; ya puede usar su cuenta',
          };
        } else {
          log.info('[VERIFY_PHONE] Phone could not be verified');
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'El codigo no pudo verificarse o es incorrecto',
          });
        }
      } catch (error: any) {
        if (
          error instanceof RestException &&
          error.code === TWILIO_BLOCKED_ERROR_CODE
        ) {
          await addPhoneToBlockedList(prisma, phoneNumber);
        }

        log.error(`[VERIFY_PHONE] Error while verifying code ${error.message}`);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'El codigo no pudo verificarse o es incorrecto',
        });
      }
    },
  );
