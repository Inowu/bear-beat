import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { log } from '../server';
import { verifyMarketingUnsubscribe } from '../comms/unsubscribe';

const payloadSchema = z.object({
  u: z.coerce.number().int().positive(),
  sig: z.string().min(8),
});

const resolveClientUrl = (): string => (process.env.CLIENT_URL || 'https://thebearbeat.com').trim();

const renderPage = (params: { title: string; message: string; ok: boolean }): string => {
  const { title, message, ok } = params;
  const clientUrl = resolveClientUrl();
  const bg = ok ? '#0b1220' : '#111827';
  const accent = ok ? '#22c55e' : '#f59e0b';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:24px;background:${bg};color:#e5e7eb;font-family:Arial, sans-serif;">
    <div style="max-width:720px;margin:0 auto;border:1px solid rgba(255,255,255,0.12);border-radius:16px;background:rgba(255,255,255,0.04);padding:18px 18px 14px 18px;">
      <div style="font-weight:900;font-size:18px;letter-spacing:-0.01em;">Bear Beat</div>
      <h1 style="margin:14px 0 8px 0;font-size:22px;line-height:1.2;">${title}</h1>
      <p style="margin:0 0 14px 0;line-height:1.6;color:rgba(229,231,235,0.9);">${message}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <a href="${clientUrl}/micuenta" style="display:inline-block;background:${accent};color:#0b1220;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:900;">Ir a mi cuenta</a>
        <a href="${clientUrl}" style="display:inline-block;color:rgba(229,231,235,0.92);text-decoration:underline;text-underline-offset:3px;">Volver al sitio</a>
      </div>
      <p style="margin:14px 0 0 0;font-size:12px;line-height:1.45;color:rgba(229,231,235,0.66);">
        Nota: Esta opción solo cancela promociones. Los correos transaccionales (como pagos o restablecer contraseña) pueden seguir llegando.
      </p>
    </div>
  </body>
</html>`;
};

const parseRequest = (req: Request): { u: number; sig: string } | null => {
  const raw: any = {
    u: typeof req.query.u === 'string' ? req.query.u : (req.body?.u ?? ''),
    sig: typeof req.query.sig === 'string' ? req.query.sig : (req.body?.sig ?? ''),
  };

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { u: parsed.data.u, sig: parsed.data.sig };
};

export const commsUnsubscribeEndpoint = async (req: Request, res: Response) => {
  const parsed = parseRequest(req);
  if (!parsed) {
    res.status(400).send(
      renderPage({
        ok: false,
        title: 'Enlace inválido',
        message: 'El enlace de desuscripción no es válido. Si el problema persiste, contacta a soporte.',
      }),
    );
    return;
  }

  const { u: userId, sig } = parsed;

  if (!verifyMarketingUnsubscribe(userId, sig)) {
    res.status(403).send(
      renderPage({
        ok: false,
        title: 'Enlace expirado o inválido',
        message: 'El enlace de desuscripción expiró o no es válido. Si quieres dejar de recibir promociones, entra a tu cuenta.',
      }),
    );
    return;
  }

  try {
    await prisma.users.updateMany({
      where: { id: userId },
      data: {
        email_marketing_opt_in: false,
        marketing_opt_in_updated_at: new Date(),
      },
    });
  } catch (e) {
    log.warn('[COMMS] Unsubscribe failed (non-blocking)', {
      userId,
      error: e instanceof Error ? e.message : e,
    });
  }

  res.status(200).send(
    renderPage({
      ok: true,
      title: 'Listo, ya no recibirás promociones por email',
      message: 'Tu preferencia fue actualizada. Si fue un error, puedes reactivarlo desde tu cuenta.',
    }),
  );
};
