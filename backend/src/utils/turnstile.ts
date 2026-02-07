import axios from 'axios';
import { TRPCError } from '@trpc/server';
import { log } from '../server';

type TurnstileVerifyResponse = {
  success: boolean;
  'error-codes'?: string[];
};

type TurnstileVerifyInput = {
  token: string;
  remoteIp?: string | null;
};

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_BYPASS_TOKEN = '__TURNSTILE_LOCAL_BYPASS__';

export const verifyTurnstileToken = async ({
  token,
  remoteIp,
}: TurnstileVerifyInput): Promise<void> => {
  const bypassEnabled =
    process.env.TURNSTILE_BYPASS === 'true' || process.env.NODE_ENV !== 'production';

  if (bypassEnabled && token === TURNSTILE_BYPASS_TOKEN) {
    log.info('[TURNSTILE] Local bypass token accepted');
    return;
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (bypassEnabled) {
      log.warn('[TURNSTILE] Missing TURNSTILE_SECRET_KEY, bypassing verification in non-production');
      return;
    }
    log.error('[TURNSTILE] Missing TURNSTILE_SECRET_KEY');
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Verificacion de seguridad no disponible',
    });
  }

  if (!token) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Verificacion de seguridad requerida',
    });
  }

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (remoteIp) {
    form.set('remoteip', remoteIp);
  }

  try {
    const { data } = await axios.post<TurnstileVerifyResponse>(
      TURNSTILE_VERIFY_URL,
      form,
      {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
      },
    );

    if (!data.success) {
      log.warn(
        `[TURNSTILE] Verification failed ${JSON.stringify(
          data['error-codes'] ?? [],
        )}`,
      );
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'La verificacion de seguridad fallo',
      });
    }
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    const errorMessage =
      error instanceof Error ? error.message : 'unknown error';
    log.error(`[TURNSTILE] Verification error: ${errorMessage}`);
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'La verificacion de seguridad fallo',
    });
  }
};
