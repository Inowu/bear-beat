import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { publicProcedure } from '../../../procedures/public.procedure';
import { log } from '../../../server';
import { addHours } from 'date-fns';
import { twilio } from '../../../twilio';
import { verifyTurnstileToken } from '../../../utils/turnstile';
import { isEmailConfigured, sendPasswordResetEmail } from '../../../email';

export const forgotPassword = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
      turnstileToken: z
        .string()
        .min(1, 'La verificación de seguridad es requerida'),
    }),
  )
  .mutation(async ({ input: { email, turnstileToken }, ctx: { prisma, req } }) => {
    await verifyTurnstileToken({ token: turnstileToken, remoteIp: req.ip });

    const user = await prisma.users.findFirst({
      where: {
        email,
      },
    });

    if (!user) {
      log.info(`[FORGOT_PASSWORD] User with email ${email} not found`);
      // Security UX: always return the same response.
      return {
        message:
          'Si el correo está registrado, te enviaremos un enlace. Revisa Spam/Promociones.',
      };
    }

    const token = crypto.randomBytes(32).toString('hex');

    const hashedToken = bcrypt.hashSync(token, 10);

    await prisma.users.update({
      where: {
        id: user.id,
      },
      data: {
        activationcode: hashedToken,
        token_expiration: addHours(new Date(), 1),
      },
    });

    log.info(`[FORGOT_PASSWORD] Sending email to ${user.email}`);

    const link = `${process.env.CLIENT_URL}/auth/reset-password?token=${token}&userId=${user.id}`;

    if (isEmailConfigured()) {
      // Best-effort: never break the flow on delivery errors.
      await sendPasswordResetEmail({
        userId: user.id,
        toEmail: user.email,
        toName: user.username,
        toAccountEmail: user.email,
        link,
      });
    } else {
      log.warn('[FORGOT_PASSWORD] Email not configured; skipping email send');
    }

    // Optional WhatsApp: best-effort (do not break the flow).
    if (user.phone) {
      try {
        log.info(`[TWILIO_SEND_MESSAGE] Sending WhatsApp to ${user.phone}`);
        await twilio.sendMessage(user.phone, link);
      } catch (error) {
        log.error('[TWILIO_SEND_MESSAGE_ERROR]', error);
      }
    }

    return {
      message:
        'Si el correo está registrado, te enviaremos un enlace. Revisa Spam/Promociones.',
    };
  });
