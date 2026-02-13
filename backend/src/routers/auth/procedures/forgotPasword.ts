import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { publicProcedure } from '../../../procedures/public.procedure';
import { log } from '../../../server';
import { brevo } from '../../../email';
import { addHours } from 'date-fns';
import { twilio } from '../../../twilio';
import { verifyTurnstileToken } from '../../../utils/turnstile';

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

    const hasBrevoKey = Boolean(process.env.BREVO_API_KEY?.trim());

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

    if (hasBrevoKey) {
      try {
        await brevo.smtp.sendTransacEmail({
          templateId: 1,
          to: [{ email: user.email, name: user.username }],
          params: {
            NAME: user.username,
            EMAIL: user.email,
            LINK: link,
          },
        });
      } catch (e) {
        // Don't reveal delivery errors to the user; frontend already shows neutral copy.
        log.error('[FORGOT_PASSWORD] Brevo send failed', e);
      }
    } else {
      log.warn('[FORGOT_PASSWORD] Brevo not configured; skipping email send');
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
