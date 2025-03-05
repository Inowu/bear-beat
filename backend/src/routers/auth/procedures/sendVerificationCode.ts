import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../../procedures/public.procedure';
import { log } from '../../../server';
import { twilio } from '../../../twilio';

export const sendVerificationCode = publicProcedure
  .input(
    z.object({
      phoneNumber: z.string(),
      userId: z.number(),
    }),
  )
  .mutation(
    async ({ input: { phoneNumber, userId }, ctx: { req, prisma } }) => {
      const existingUser = await prisma.users.findFirst({
        where: {
          id: {
            equals: userId,
          },
        },
      });

      if (!existingUser) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No se encuentra el usuario con ese ID',
        });
      }

      try {
        const response = await twilio.getVerificationCode(phoneNumber);

        return response;
      } catch (error: any) {
        log.error('[SEND_VERIFICATION_CODE_ERROR] Code could not be sent');
        log.error(error);

        return 'sent';
        // throw new TRPCError({
        //   code: 'BAD_REQUEST',
        //   message:
        //     'Hubo un error al momento de enviar el codigo, intente mas tarde.',
        // });
      }
    },
  );
