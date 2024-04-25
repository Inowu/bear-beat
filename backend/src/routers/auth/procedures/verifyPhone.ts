import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../../procedures/public.procedure';
import { log } from '../../../server';
import { twilio } from '../../../twilio';

export const verifyPhone = publicProcedure
    .input(
        z.object({
            code: z
                .string()
                .min(6, { message: 'El codigo debe tener al menos 6 caracteres' }),
            phoneNumber: z.string(),
            userId: z.number(),
        }),
    )
    .mutation(
        async ({
            input: { code, phoneNumber, userId },
            ctx: { req, prisma },
        }) => {
            const existingUser = await prisma.users.findFirst({
                where: {
                    id: {
                        equals: userId
                    }
                },
            });

            if (!existingUser) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'No se encuentra el usuario con ese ID',
                });
            }

            try {
                const verificationCode = await twilio.verifyCode(phoneNumber, code);

                if (verificationCode) {
                    log.info('[VERIFY_PHONE] Phone was successfully verified');
                    await prisma.users.update({
                        where: {
                            id: userId,
                        },
                        data: {
                            verified: true
                        },
                    });

                    return {
                        success: true,
                        message: "El telefono ha sido verificado; ya puede usar su cuenta"
                    }
                } else {
                    log.info('[VERIFY_PHONE] Phone could not be verified');
                    return {
                        success: false,
                        message: "El codigo no pudo verificarse o es incorrecto"
                    }
                }
            } catch (error: any) {
                log.error(`[VERIFY_PHONE] Error while verifying code ${error.message}`);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'El codigo no pudo verificarse o es incorrecto',
                });
            }


        },
    );
