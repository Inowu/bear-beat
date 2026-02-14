import { Request, Response } from 'express';
import stripeInstance from '../stripe';
import { prisma } from '../db';
import { log } from '../server';
import { verifyStripeBillingPortalToken } from '../billing/stripeBillingPortalLink';

const resolveClientUrl = (): string => {
  const raw = String(process.env.CLIENT_URL || 'https://thebearbeat.com').trim();
  return raw.replace(/\/+$/, '');
};

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
    </div>
  </body>
</html>`;
};

export const billingPortalEndpoint = async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!token) {
    res.status(400).send(
      renderPage({
        ok: false,
        title: 'Enlace invalido',
        message: 'El enlace para actualizar tu pago no es valido o expiro. Entra a Mi cuenta para intentarlo de nuevo.',
      }),
    );
    return;
  }

  const userId = verifyStripeBillingPortalToken(token);
  if (!userId) {
    res.status(403).send(
      renderPage({
        ok: false,
        title: 'Enlace expirado o invalido',
        message: 'El enlace para actualizar tu pago expiro o no es valido. Entra a Mi cuenta para intentarlo de nuevo.',
      }),
    );
    return;
  }

  const user = await prisma.users.findFirst({
    where: { id: userId },
    select: { id: true, stripe_cusid: true, blocked: true },
  });

  if (!user || user.blocked) {
    res.status(404).send(
      renderPage({
        ok: false,
        title: 'Cuenta no disponible',
        message: 'No se pudo abrir el portal de pagos. Entra a Mi cuenta o contacta a soporte.',
      }),
    );
    return;
  }

  if (!user.stripe_cusid) {
    res.status(400).send(
      renderPage({
        ok: false,
        title: 'Portal no disponible',
        message: 'No encontramos un perfil de cobro para esta cuenta. Entra a Mi cuenta o contacta a soporte.',
      }),
    );
    return;
  }

  try {
    const portalSession = await stripeInstance.billingPortal.sessions.create({
      customer: user.stripe_cusid,
      return_url: `${resolveClientUrl()}/micuenta`,
    });
    res.redirect(302, portalSession.url);
  } catch (e) {
    log.warn('[BILLING] Failed to create Stripe billing portal session', {
      userId: user.id,
      error: e instanceof Error ? e.message : e,
    });
    res.status(500).send(
      renderPage({
        ok: false,
        title: 'No se pudo abrir el portal',
        message: 'Intenta mas tarde. Si el problema persiste, contacta a soporte.',
      }),
    );
  }
};

