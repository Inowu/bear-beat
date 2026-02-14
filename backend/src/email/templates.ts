const escapeHtml = (value: unknown): string => {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const resolveClientUrl = (): string => {
  const raw = (process.env.CLIENT_URL || 'https://thebearbeat.com').trim();
  return raw.replace(/\/+$/, '');
};

const COLORS = {
  bg: '#F3F7FA',
  card: '#FFFFFF',
  cardSoft: '#F8FBFD',
  border: 'rgba(15, 23, 42, 0.12)',
  ink: '#0B1220',
  text: '#1F2A3A',
  muted: '#556274',
  dark: '#0B1220',
  cyan: '#08E1F7',
  mint: '#00E6C1',
  accentInk: '#007C89',
} as const;

const FONT_UI = `Manrope, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
const FONT_MONO =
  `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;

const resolveEmailLogoUrl = (): string => {
  const override = (process.env.EMAIL_LOGO_URL || '').trim();
  if (override) return override;
  // Stored in frontend/public/brand/ so it is served as a real asset (not SPA html).
  return `${resolveClientUrl()}/brand/bearbeat-lockup-cyan.png`;
};

const renderLayout = (params: {
  title: string;
  preheader?: string;
  contentHtml: string;
  unsubscribeUrl?: string;
}): string => {
  const { title, preheader, contentHtml, unsubscribeUrl } = params;
  const safeTitle = escapeHtml(title);
  const safePreheader = preheader ? escapeHtml(preheader) : '';
  const safeUnsubUrl = unsubscribeUrl ? escapeHtml(unsubscribeUrl) : '';
  const clientUrl = resolveClientUrl();
  const clientUrlShort = escapeHtml(clientUrl.replace(/^https?:\/\//, ''));
  const logoUrl = escapeHtml(resolveEmailLogoUrl());
  const year = new Date().getFullYear();

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light only" />
        <title>${safeTitle}</title>
      </head>
      <body style="margin:0;padding:0;background:${COLORS.bg};">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          ${safePreheader}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.bg}" style="background:${COLORS.bg};">
          <tr>
            <td align="center" style="padding:28px 12px;">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
                <tr>
                  <td style="border-radius:18px;overflow:hidden;border:1px solid ${COLORS.border};box-shadow:0 18px 46px rgba(15, 23, 42, 0.12);">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.card}" style="background:${COLORS.card};">
                      <tr>
                        <td height="6" bgcolor="${COLORS.cyan}" style="height:6px;line-height:6px;font-size:0;background:${COLORS.cyan};background-image:linear-gradient(11deg, ${COLORS.mint}, ${COLORS.cyan});">
                          &nbsp;
                        </td>
                      </tr>
                      <tr>
                        <td bgcolor="${COLORS.dark}" style="background:${COLORS.dark};padding:18px 22px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td valign="middle" style="padding:0;">
                                <img src="${logoUrl}" width="148" alt="Bear Beat" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:148px;" />
                              </td>
                              <td valign="middle" align="right" style="padding:0;font-family:${FONT_UI};font-size:12px;line-height:1.3;color:rgba(255,255,255,0.72);">
                                ${clientUrlShort}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:22px 22px 10px 22px;font-family:${FONT_UI};color:${COLORS.ink};">
                          ${contentHtml}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 22px 22px 22px;font-family:${FONT_UI};color:${COLORS.muted};">
                          <div style="border-top:1px solid ${COLORS.border};padding-top:14px;font-size:12px;line-height:1.55;color:${COLORS.muted};">
                            <div>Si no reconoces esta actividad, ignora este correo.</div>
                            ${unsubscribeUrl ? `<div style="padding-top:8px;"><a href="${safeUnsubUrl}" style="color:${COLORS.muted};text-decoration:underline;text-underline-offset:3px;">Cancelar promociones</a></div>` : ''}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 8px 0 8px;font-family:${FONT_UI};font-size:11px;line-height:1.6;color:${COLORS.muted};text-align:center;">
                    Bear Beat · ${escapeHtml(year)} · <a href="${escapeHtml(clientUrl)}" style="color:${COLORS.muted};text-decoration:underline;text-underline-offset:3px;">${clientUrlShort}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `.trim();
};

const renderButton = (params: { href: string; label: string }): string => {
  const { href, label } = params;
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);

  // Bulletproof button (table-based) for Outlook/Gmail.
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
      <tr>
        <td align="center" bgcolor="${COLORS.cyan}" style="border-radius:14px;background:${COLORS.cyan};background-image:linear-gradient(11deg, ${COLORS.mint}, ${COLORS.cyan});">
          <a href="${safeHref}" style="display:inline-block;padding:12px 18px;font-family:${FONT_UI};font-size:16px;line-height:1.2;font-weight:900;letter-spacing:-0.01em;color:${COLORS.dark};text-decoration:none;border-radius:14px;">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>
  `.trim();
};

const appendMarketingUnsubscribeText = (text: string, unsubscribeUrl?: string): string => {
  const url = (unsubscribeUrl || '').trim();
  if (!url) return text;
  return `${text}\n\nCancelar promociones: ${url}\n`;
};

export const emailTemplates = {
  welcome: (params: {
    name: string;
    email: string;
    plansUrl: string;
    accountUrl: string;
    unsubscribeUrl?: string;
  }) => {
    const { name, email, plansUrl, accountUrl, unsubscribeUrl } = params;
    const subject = `Bienvenido a Bear Beat, ${String(name || '').trim() || 'DJ'}`;
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-size:28px;line-height:1.15;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        Bienvenido, ${escapeHtml(name)}
      </h1>
      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Tu cuenta ya está lista. Activa tu plan y empieza a descargar en minutos.
      </p>
      <div style="margin:16px 0 18px 0;">
        ${renderButton({ href: plansUrl, label: 'Ver planes' })}
      </div>
      <div style="background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px 14px 12px 14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          Tu cuenta
        </div>
        <div style="margin-top:6px;font-size:15px;line-height:1.45;color:${COLORS.ink};">
          Email: <strong>${escapeHtml(email)}</strong>
        </div>
      </div>
      <p style="margin:14px 0 0 0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Importante: para descargar necesitas verificar tu WhatsApp. Puedes hacerlo desde
        <a href="${escapeHtml(accountUrl)}" style="color:${COLORS.accentInk};text-decoration:underline;text-underline-offset:3px;">Mi cuenta</a>.
      </p>
    `.trim();

    const text =
      `Bienvenido, ${name}\n\n` +
      `Tu cuenta ya está lista. Activa tu plan aquí:\n${plansUrl}\n\n` +
      `Email registrado: ${email}\n\n` +
      `Para descargar necesitas verificar tu WhatsApp desde Mi cuenta:\n${accountUrl}\n`;

    return {
      subject,
      html: renderLayout({
        title: subject,
        preheader: 'Tu cuenta ya está lista.',
        contentHtml,
        unsubscribeUrl,
      }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  passwordReset: (params: { name: string; email: string; link: string; unsubscribeUrl?: string }) => {
    const { name, email, link, unsubscribeUrl } = params;
    const title = 'Restablece tu contraseña';
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        ${escapeHtml(title)}
      </h1>
      <p style="margin:0 0 14px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>, recibimos una solicitud para restablecer tu contraseña.
      </p>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: link, label: 'Restablecer contraseña' })}
      </div>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
        <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(link)}</span>
      </p>
      <p style="margin:14px 0 0 0;font-size:12px;line-height:1.6;color:${COLORS.muted};">
        Cuenta: <strong style="color:${COLORS.ink};">${escapeHtml(email)}</strong>
      </p>
    `.trim();

    const text =
      `Restablece tu contraseña\n\n` +
      `Hola ${name}, recibimos una solicitud para restablecer tu contraseña.\n` +
      `Enlace: ${link}\n\n` +
      `Cuenta: ${email}\n`;

    return {
      subject: title,
      html: renderLayout({ title, preheader: 'Enlace para restablecer tu contraseña.', contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  planActivated: (params: {
    name: string;
    planName: string;
    price: unknown;
    currency: string;
    orderId: unknown;
    catalogUrl: string;
    accountUrl: string;
    unsubscribeUrl?: string;
  }) => {
    const { name, planName, price, currency, orderId, catalogUrl, accountUrl, unsubscribeUrl } = params;
    const title = 'Tu plan está activo';
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        ${escapeHtml(title)}
      </h1>
      <p style="margin:0 0 14px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>, tu suscripción fue activada correctamente.
      </p>
      <div style="background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px 14px 12px 14px;margin:14px 0 16px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;font-size:13px;line-height:1.55;color:${COLORS.muted};">Plan</td>
            <td style="padding:8px 0;font-size:13px;line-height:1.55;color:${COLORS.ink};text-align:right;font-weight:900;">${escapeHtml(planName)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;line-height:1.55;color:${COLORS.muted};">Precio</td>
            <td style="padding:8px 0;font-size:13px;line-height:1.55;color:${COLORS.ink};text-align:right;font-weight:900;">${escapeHtml(price)} ${escapeHtml(currency)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;line-height:1.55;color:${COLORS.muted};">Orden</td>
            <td style="padding:8px 0;font-size:13px;line-height:1.55;color:${COLORS.ink};text-align:right;font-weight:900;">#${escapeHtml(orderId)}</td>
          </tr>
        </table>
      </div>
      <div style="margin:18px 0 0 0;">
        ${renderButton({ href: catalogUrl, label: 'Ir al catálogo' })}
      </div>
      <p style="margin:14px 0 0 0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Tip: si te pide verificación, completa tu WhatsApp en
        <a href="${escapeHtml(accountUrl)}" style="color:${COLORS.accentInk};text-decoration:underline;text-underline-offset:3px;">Mi cuenta</a>
        y listo.
      </p>
    `.trim();

    const text =
      `Tu plan está activo\n\n` +
      `Hola ${name}, tu suscripción fue activada correctamente.\n` +
      `Plan: ${planName}\n` +
      `Precio: ${price} ${currency}\n` +
      `Orden: #${orderId}\n`;

    return {
      subject: title,
      html: renderLayout({ title, preheader: `Plan activo: ${planName}`, contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  automationTrialNoDownload24h: (params: { name: string; url: string; unsubscribeUrl?: string }) => {
    const { name, url, unsubscribeUrl } = params;
    const title = 'Tu prueba sigue activa';
    const subject = `[Bear Beat] ${title}`;
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        ${escapeHtml(title)}
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>. Entra y empieza con tus primeras descargas hoy.
      </p>
      <div style="margin:14px 0 14px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          En 3 pasos
        </div>
        <ol style="margin:10px 0 0 18px;padding:0;color:${COLORS.text};font-size:14px;line-height:1.65;">
          <li>Entra a Bear Beat</li>
          <li>Busca por carpeta o por nombre</li>
          <li>Descarga y listo</li>
        </ol>
      </div>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Empezar ahora' })}
      </div>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
        <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
      </p>
    `.trim();

    const text = `Hola ${name},\n\nTu prueba sigue activa. Entra aquí para empezar:\n${url}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Tu prueba sigue activa.', contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  automationPaidNoDownload24h: (params: { name: string; url: string; unsubscribeUrl?: string }) => {
    const { name, url, unsubscribeUrl } = params;
    const title = 'Tu plan está activo';
    const subject = `[Bear Beat] ${title}`;
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        ${escapeHtml(title)}
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>. Ya puedes descargar: entra y empieza a armar tus sets.
      </p>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Ir a Bear Beat' })}
      </div>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
        <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
      </p>
    `.trim();

    const text = `Hola ${name},\n\nTu plan está activo. Entra aquí para comenzar tus descargas:\n${url}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Tu plan está activo.', contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  automationRegisteredNoPurchase7d: (params: { name: string; url: string; unsubscribeUrl?: string }) => {
    const { name, url, unsubscribeUrl } = params;
    const title = 'Elige tu plan';
    const subject = `[Bear Beat] ${title}`;
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        ${escapeHtml(title)}
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>. Activa tu plan y empieza a descargar hoy mismo.
      </p>
      <div style="margin:14px 0 14px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <ul style="margin:0;padding:0 0 0 18px;color:${COLORS.text};font-size:14px;line-height:1.65;">
          <li>Catálogo organizado por carpetas (rápido para cabina)</li>
          <li>Descargas listas para tu set</li>
          <li>Acceso inmediato al activar</li>
        </ul>
      </div>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Ver planes' })}
      </div>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
        <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
      </p>
    `.trim();

    const text = `Hola ${name},\n\nElige tu plan aquí:\n${url}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Elige tu plan.', contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  automationPlansOffer: (params: {
    name: string;
    url: string;
    couponCode: string;
    percentOff: number;
    expiresAt: string;
    unsubscribeUrl?: string;
  }) => {
    const { name, url, couponCode, percentOff, expiresAt, unsubscribeUrl } = params;
    const pct = Math.max(0, Math.min(99, Math.floor(Number(percentOff) || 0)));
    const safeCoupon = String(couponCode || '').trim();
    const subject = `[Bear Beat] Cupón ${pct}% para activar tu plan`;

    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        ${escapeHtml(`Tu cupón ${pct}% está listo`)}
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>, te guardamos un cupón de <strong>${escapeHtml(pct)}%</strong>.
      </p>
      <div style="margin:14px 0 12px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-family:${FONT_MONO};font-size:12px;color:${COLORS.muted};margin-bottom:8px;">
          Código
        </div>
        <div style="font-family:${FONT_MONO};font-size:20px;font-weight:950;letter-spacing:0.08em;color:${COLORS.ink};">
          ${escapeHtml(safeCoupon)}
        </div>
        <div style="margin-top:10px;font-size:12px;color:${COLORS.muted};line-height:1.5;">
          Válido hasta: <strong style="color:${COLORS.ink};">${escapeHtml(expiresAt)}</strong>
        </div>
      </div>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: `Activar con ${pct}%` })}
      </div>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Normalmente se aplica automáticamente al entrar con tu cuenta. Si te lo pide, pega el código en el checkout.
      </p>
      <p style="margin:12px 0 0 0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
      </p>
    `.trim();

    const text =
      `Tu cupón ${pct}% está listo\n\n` +
      `Hola ${name}, te guardamos un cupón de ${pct}% para activar tu plan.\n\n` +
      `Código: ${safeCoupon}\n` +
      `Válido hasta: ${expiresAt}\n\n` +
      `Link: ${url}\n\n` +
      `Si te lo pide, pega el código en el checkout.\n`;

    return {
      subject,
      html: renderLayout({
        title: subject,
        preheader: `Cupón ${pct}% por tiempo limitado`,
        contentHtml,
        unsubscribeUrl,
      }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  automationVerifyWhatsApp24h: (params: { name: string; url: string }) => {
    const { name, url } = params;
    const subject = `[Bear Beat] Verifica tu WhatsApp para descargar`;
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        Verifica tu WhatsApp (1 minuto)
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>, para descargar en Bear Beat necesitamos verificar tu WhatsApp.
      </p>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Ir a Mi cuenta' })}
      </div>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Si aún no agregaste tu número, ahí mismo lo registras y te llega el código por WhatsApp (o SMS si WhatsApp falla).
      </p>
    `.trim();

    const text =
      `Verifica tu WhatsApp (1 minuto)\n\n` +
      `Hola ${name}, para descargar necesitamos verificar tu WhatsApp.\n\n` +
      `Entra aquí: ${url}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Falta un paso para descargar.', contentHtml }),
      text,
    };
  },

  automationCheckoutAbandoned: (params: {
    name: string;
    url: string;
    planName?: string | null;
    price?: string | number | null;
    currency?: string | null;
    unsubscribeUrl?: string;
  }) => {
    const { name, url, planName, price, currency, unsubscribeUrl } = params;
    const subject = `[Bear Beat] Te quedaste a un paso de activar`;
    const planLine =
      planName
        ? `<div style="margin-top:8px;font-size:13px;line-height:1.6;color:${COLORS.muted};">
            Plan: <strong style="color:${COLORS.ink};">${escapeHtml(planName)}</strong>
            ${price ? ` · <strong style="color:${COLORS.ink};">${escapeHtml(price)} ${escapeHtml(currency || '')}</strong>` : ''}
          </div>`
        : '';

    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        Te quedaste a un paso
      </h1>
      <p style="margin:0 0 10px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>, vimos que intentaste activar tu acceso pero no se completó.
      </p>
      ${planLine}
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Continuar compra' })}
      </div>
      <div style="margin:14px 0 0 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          Tip rápido
        </div>
        <div style="margin-top:8px;font-size:13px;line-height:1.65;color:${COLORS.text};">
          Si estabas en el celular, prueba con otro método (tarjeta, SPEI u OXXO) y se activa al confirmar.
        </div>
      </div>
      <p style="margin:12px 0 0 0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
      </p>
    `.trim();

    const text =
      `Te quedaste a un paso\n\n` +
      `Hola ${name}, vimos que intentaste activar tu acceso pero no se completó.\n` +
      (planName ? `Plan: ${planName}${price ? ` · ${price} ${currency || ''}` : ''}\n\n` : '\n') +
      `Continuar: ${url}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Completa tu activación.', contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  automationTrialExpiring24h: (params: { name: string; url: string; unsubscribeUrl?: string }) => {
    const { name, url, unsubscribeUrl } = params;
    const subject = `[Bear Beat] Tu prueba termina en 24h`;
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        Tu prueba termina en 24h
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>. Si quieres seguir descargando sin interrupciones, activa tu plan hoy.
      </p>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Ver planes' })}
      </div>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Recuerda: para descargar necesitas verificar tu WhatsApp.
      </p>
    `.trim();

    const text =
      `Tu prueba termina en 24h\n\n` +
      `Hola ${name}. Activa tu plan aquí:\n${url}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Últimas 24h de prueba.', contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  automationActiveNoDownload: (params: { name: string; url: string; days: number; unsubscribeUrl?: string }) => {
    const { name, url, days, unsubscribeUrl } = params;
    const safeDays = Math.max(1, Math.min(60, Math.floor(Number(days) || 0)));
    const subject = `[Bear Beat] Llevas ${safeDays} días sin descargar`;
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        Vuelve a descargar hoy
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>. Llevas <strong>${escapeHtml(safeDays)}</strong> días sin descargar.
        Entra y revisa las carpetas: seguro ya hay material listo para tu set.
      </p>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Ir al catálogo' })}
      </div>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
      </p>
    `.trim();

    const text =
      `Vuelve a descargar hoy\n\n` +
      `Hola ${name}. Llevas ${safeDays} días sin descargar.\n\n` +
      `Entra aquí: ${url}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Tu acceso sigue activo.', contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  analyticsAlerts: (params: { days: number; count: number; detailsText: string; generatedAt: string }) => {
    const { days, count, detailsText, generatedAt } = params;
    const subject = `[Bear Beat] Alerts de analytics (${count}) · ${days}d`;
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-size:22px;line-height:1.2;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        ${escapeHtml(subject)}
      </h1>
      <p style="margin:0 0 12px 0;font-size:14px;line-height:1.65;color:${COLORS.text};">
        Ventana: últimos <strong>${escapeHtml(days)}</strong> días.
      </p>
      <pre style="white-space: pre-wrap; background: ${COLORS.cardSoft}; padding: 12px; border-radius: 12px; border: 1px solid ${COLORS.border}; font-size: 12px; line-height: 1.55; color: ${COLORS.ink}; font-family: ${FONT_MONO};">${escapeHtml(
        detailsText,
      )}</pre>
      <p style="margin:12px 0 0 0;font-size:12px;line-height:1.6;color:${COLORS.muted};">
        Generado: ${escapeHtml(generatedAt)}
      </p>
    `.trim();

    const text = `${subject}\n\n${detailsText}\n\nGenerado: ${generatedAt}\n`;
    return {
      subject,
      html: renderLayout({ title: subject, preheader: `${count} alert(s) en los últimos ${days} días`, contentHtml }),
      text,
    };
  },
};
