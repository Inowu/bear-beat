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

const appendQueryParams = (baseUrl: string, params: Record<string, string>): string => {
  try {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
};

const COLORS = {
  // Email theme: match Bear Beat's neon-on-dark brand.
  // Keep it simple + readable across Gmail/Outlook clients.
  // NOTE: avoid rgba() for text colors; some email clients render it poorly.
  bg: '#070A12',
  card: '#0B1220',
  cardSoft: '#111A2A',
  border: '#22304A',
  ink: '#F8FAFC',
  text: '#E8EEF7',
  muted: '#B9C7DA',
  dark: '#000000',
  cyan: '#08E1F7',
  mint: '#00E6C1',
  accentInk: '#08E1F7',
} as const;

const FONT_UI = `Manrope, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
const FONT_BRAND = `"Bear-font", Manrope, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
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
        <meta name="color-scheme" content="dark light" />
        <meta name="supported-color-schemes" content="dark light" />
        <title>${safeTitle}</title>
      </head>
      <body style="margin:0;padding:0;background:${COLORS.bg};color:${COLORS.ink};">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          ${safePreheader}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.bg}" style="background:${COLORS.bg};">
          <tr>
            <td align="center" style="padding:28px 12px;">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
                <tr>
                  <td style="border-radius:18px;overflow:hidden;border:1px solid ${COLORS.border};box-shadow:0 24px 70px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(8, 225, 247, 0.10);">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.card}" style="background:${COLORS.card};">
                      <tr>
                        <td height="6" bgcolor="${COLORS.cyan}" style="height:6px;line-height:6px;font-size:0;background:${COLORS.cyan};background-image:linear-gradient(11deg, ${COLORS.mint}, ${COLORS.cyan});">
                          &nbsp;
                        </td>
                      </tr>
                      <tr>
                        <td bgcolor="${COLORS.card}" style="background:${COLORS.card};padding:26px 22px 18px 22px;text-align:center;">
                          <a href="${escapeHtml(clientUrl)}" style="text-decoration:none;display:inline-block;">
                            <img src="${logoUrl}" width="176" alt="Bear Beat" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:176px;margin:0 auto;" />
                          </a>
                          <div style="margin-top:10px;font-family:${FONT_UI};font-size:12px;line-height:1.4;color:${COLORS.muted};letter-spacing:0.14em;text-transform:uppercase;">
                            ${clientUrlShort}
                          </div>
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
        <td align="center" bgcolor="${COLORS.cyan}" style="border-radius:14px;background:${COLORS.cyan};background-image:linear-gradient(11deg, ${COLORS.mint}, ${COLORS.cyan});box-shadow:0 14px 30px rgba(8, 225, 247, 0.14);">
          <a href="${safeHref}" style="display:inline-block;padding:12px 18px;font-family:${FONT_UI};font-size:16px;line-height:1.2;font-weight:950;letter-spacing:-0.01em;color:${COLORS.dark};text-decoration:none;border-radius:14px;">
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
    const safeName = String(name || '').trim() || 'DJ';
    const subject = `Tu cabina está lista, ${safeName}`;
    const instructionsUrl = appendQueryParams(`${resolveClientUrl()}/instrucciones`, {
      utm_source: 'email',
      utm_medium: 'transactional',
      utm_campaign: 'welcome',
      utm_content: 'link_instructions',
    });
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:28px;line-height:1.15;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        Bienvenido, ${escapeHtml(safeName)}
      </h1>
      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Bear Beat es tu biblioteca para cabina: <strong style="color:${COLORS.ink};">video remixes, audios y karaokes</strong>
        organizados por carpetas para que encuentres r&aacute;pido y llegues con repertorio listo.
      </p>
      <div style="margin:14px 0 14px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          Empieza en 3 pasos
        </div>
        <ol style="margin:10px 0 0 18px;padding:0;color:${COLORS.text};font-size:14px;line-height:1.65;">
          <li>Elige tu plan (activaci&oacute;n inmediata).</li>
          <li>Verifica tu WhatsApp (habilita descargas).</li>
          <li>Descarga por FTP (FileZilla/Air Explorer) o por web.</li>
        </ol>
      </div>
      <div style="margin:16px 0 10px 0;">
        ${renderButton({ href: plansUrl, label: 'Activar acceso' })}
      </div>
      <p style="margin:0 0 14px 0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Gu&iacute;a de descarga paso a paso:
        <a href="${escapeHtml(instructionsUrl)}" style="color:${COLORS.accentInk};text-decoration:underline;text-underline-offset:3px;">/instrucciones</a>
      </p>
      <div style="background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px 14px 12px 14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          Tu cuenta
        </div>
        <div style="margin-top:6px;font-size:15px;line-height:1.45;color:${COLORS.ink};">
          Email: <strong>${escapeHtml(email)}</strong>
        </div>
      </div>
      <p style="margin:14px 0 0 0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Tip: la verificaci&oacute;n de WhatsApp se hace desde
        <a href="${escapeHtml(accountUrl)}" style="color:${COLORS.accentInk};text-decoration:underline;text-underline-offset:3px;">Mi cuenta</a>
        y toma 1 minuto.
      </p>
      <p style="margin:10px 0 0 0;font-size:12px;line-height:1.6;color:${COLORS.muted};">
        Pago seguro &bull; Renovaci&oacute;n autom&aacute;tica &bull; Cancela cuando quieras
      </p>
    `.trim();

    const text =
      `Bienvenido, ${safeName}\n\n` +
      `Bear Beat es tu biblioteca para cabina: video remixes, audios y karaokes organizados para encontrar rápido.\n\n` +
      `Empieza en 3 pasos:\n` +
      `1) Elige tu plan: ${plansUrl}\n` +
      `2) Verifica tu WhatsApp en Mi cuenta: ${accountUrl}\n` +
      `3) Guía de descarga: ${instructionsUrl}\n\n` +
      `Email registrado: ${email}\n\n` +
      `Pago seguro. Renovación automática. Cancela cuando quieras.\n`;

    return {
      subject,
      html: renderLayout({
        title: subject,
        preheader: 'Activa tu acceso y llega con repertorio listo.',
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
      <h1 style="margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        ${escapeHtml(title)}
      </h1>
      <p style="margin:0 0 14px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>, recibimos una solicitud para restablecer tu contraseña.
      </p>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: link, label: 'Restablecer contraseña' })}
      </div>
      <p style="margin:0 0 12px 0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Este enlace expira en <strong style="color:${COLORS.ink};">1 hora</strong>. Si no fuiste t&uacute;, ignora este correo.
      </p>
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
      `Este enlace expira en 1 hora. Si no fuiste tú, ignora este correo.\n\n` +
      `Enlace: ${link}\n\n` +
      `Cuenta: ${email}\n`;

    return {
      subject: title,
      html: renderLayout({ title, preheader: 'Enlace seguro (expira en 1 hora).', contentHtml, unsubscribeUrl }),
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
    const title = 'Listo: tu plan está activo';
    const instructionsUrl = appendQueryParams(`${resolveClientUrl()}/instrucciones`, {
      utm_source: 'email',
      utm_medium: 'transactional',
      utm_campaign: 'plan_activated',
      utm_content: 'link_instructions',
    });
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        ${escapeHtml(title)}
      </h1>
      <p style="margin:0 0 14px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>, tu acceso ya est&aacute; activo. Entra al cat&aacute;logo y descarga lo que necesitas para tu evento.
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
      <div style="margin:0 0 14px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          Siguiente paso
        </div>
        <ol style="margin:10px 0 0 18px;padding:0;color:${COLORS.text};font-size:14px;line-height:1.65;">
          <li>Entra al cat&aacute;logo.</li>
          <li>Para carpetas grandes usa FTP (FileZilla/Air Explorer).</li>
          <li>Importa a tu software y listo.</li>
        </ol>
      </div>
      <div style="margin:18px 0 0 0;">
        ${renderButton({ href: catalogUrl, label: 'Ir al catálogo' })}
      </div>
      <p style="margin:14px 0 0 0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Gu&iacute;a de descarga:
        <a href="${escapeHtml(instructionsUrl)}" style="color:${COLORS.accentInk};text-decoration:underline;text-underline-offset:3px;">/instrucciones</a>
        &nbsp;&bull;&nbsp;
        Renovaci&oacute;n autom&aacute;tica: cancela cuando quieras desde
        <a href="${escapeHtml(accountUrl)}" style="color:${COLORS.accentInk};text-decoration:underline;text-underline-offset:3px;">Mi cuenta</a>.
      </p>
      <p style="margin:10px 0 0 0;font-size:12px;line-height:1.6;color:${COLORS.muted};">
        Tip: si te pide verificaci&oacute;n, completa tu WhatsApp en Mi cuenta (toma 1 minuto) y desbloqueas descargas.
      </p>
    `.trim();

    const text =
      `Tu plan está activo\n\n` +
      `Hola ${name}, tu acceso ya está activo.\n` +
      `Plan: ${planName}\n` +
      `Precio: ${price} ${currency}\n` +
      `Orden: #${orderId}\n\n` +
      `Catálogo: ${catalogUrl}\n` +
      `Guía de descarga: ${instructionsUrl}\n` +
      `Mi cuenta (verificación/cancelación): ${accountUrl}\n`;

    return {
      subject: title,
      html: renderLayout({ title, preheader: `Plan activo: ${planName}`, contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  automationTrialNoDownload24h: (params: { name: string; url: string; unsubscribeUrl?: string }) => {
    const { name, url, unsubscribeUrl } = params;
    const title = 'Tu primera descarga en 3 pasos';
    const subject = `[Bear Beat] ${title}`;
    const instructionsUrl = appendQueryParams(`${resolveClientUrl()}/instrucciones`, {
      utm_source: 'email',
      utm_medium: 'automation',
      utm_campaign: 'trial_no_download_24h',
      utm_content: 'link_instructions',
    });
    const accountUrl = appendQueryParams(`${resolveClientUrl()}/micuenta`, {
      utm_source: 'email',
      utm_medium: 'automation',
      utm_campaign: 'trial_no_download_24h',
      utm_content: 'link_account',
    });
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        ${escapeHtml(title)}
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>. Tu prueba est&aacute; activa y el cat&aacute;logo est&aacute; listo para cabina:
        organizado por carpetas para encontrar r&aacute;pido y llegar con repertorio listo.
      </p>
      <div style="margin:14px 0 14px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          Hazlo en 3 pasos
        </div>
        <ol style="margin:10px 0 0 18px;padding:0;color:${COLORS.text};font-size:14px;line-height:1.65;">
          <li>Entra al cat&aacute;logo.</li>
          <li>Busca por carpeta (a&ntilde;o/mes/semana/g&eacute;nero).</li>
          <li>Descarga por FTP (recomendado) o por web.</li>
        </ol>
      </div>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Entrar al catálogo' })}
      </div>
      <p style="margin:0 0 12px 0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Gu&iacute;a de descarga:
        <a href="${escapeHtml(instructionsUrl)}" style="color:${COLORS.accentInk};text-decoration:underline;text-underline-offset:3px;">/instrucciones</a>
        &nbsp;&bull;&nbsp;
        WhatsApp (para habilitar descargas):
        <a href="${escapeHtml(accountUrl)}" style="color:${COLORS.accentInk};text-decoration:underline;text-underline-offset:3px;">Mi cuenta</a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
        <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
      </p>
    `.trim();

    const text =
      `Hola ${name},\n\n` +
      `Tu prueba está activa. Tu primera descarga en 3 pasos:\n` +
      `1) Entra al catálogo: ${url}\n` +
      `2) Busca por carpetas (año/mes/semana/género)\n` +
      `3) Descarga por FTP (guía): ${instructionsUrl}\n\n` +
      `WhatsApp (para habilitar descargas): ${accountUrl}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Tu prueba está activa. Descarga hoy.', contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  automationPaidNoDownload24h: (params: { name: string; url: string; unsubscribeUrl?: string }) => {
    const { name, url, unsubscribeUrl } = params;
    const title = 'Listo: ya puedes descargar';
    const subject = `[Bear Beat] ${title}`;
    const instructionsUrl = appendQueryParams(`${resolveClientUrl()}/instrucciones`, {
      utm_source: 'email',
      utm_medium: 'automation',
      utm_campaign: 'paid_no_download_24h',
      utm_content: 'link_instructions',
    });
    const accountUrl = appendQueryParams(`${resolveClientUrl()}/micuenta`, {
      utm_source: 'email',
      utm_medium: 'automation',
      utm_campaign: 'paid_no_download_24h',
      utm_content: 'link_account',
    });
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        ${escapeHtml(title)}
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>. Tu acceso est&aacute; activo. Entra al cat&aacute;logo y baja lo que necesitas para cabina:
        todo organizado por carpetas para encontrar r&aacute;pido.
      </p>
      <div style="margin:14px 0 14px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          Para ir r&aacute;pido
        </div>
        <ul style="margin:10px 0 0 18px;padding:0;color:${COLORS.text};font-size:14px;line-height:1.65;">
          <li>Carpetas por a&ntilde;o/mes/semana/g&eacute;nero</li>
          <li>FTP (FileZilla/Air Explorer) recomendado para carpetas grandes</li>
          <li>Cancela cuando quieras desde Mi cuenta</li>
        </ul>
      </div>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Ir al catálogo' })}
      </div>
      <p style="margin:0 0 12px 0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Gu&iacute;a de descarga:
        <a href="${escapeHtml(instructionsUrl)}" style="color:${COLORS.accentInk};text-decoration:underline;text-underline-offset:3px;">/instrucciones</a>
        &nbsp;&bull;&nbsp;
        Gestiona tu suscripci&oacute;n desde
        <a href="${escapeHtml(accountUrl)}" style="color:${COLORS.accentInk};text-decoration:underline;text-underline-offset:3px;">Mi cuenta</a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
        <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
      </p>
    `.trim();

    const text =
      `Hola ${name},\n\n` +
      `Tu acceso está activo. Entra al catálogo:\n${url}\n\n` +
      `Guía de descarga: ${instructionsUrl}\n` +
      `Mi cuenta (cancelación/soporte): ${accountUrl}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Tu acceso está activo. Descarga hoy.', contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  automationRegisteredNoPurchase7d: (params: { name: string; url: string; unsubscribeUrl?: string }) => {
    const { name, url, unsubscribeUrl } = params;
    const title = 'Precio simple, catálogo gigante';
    const subject = `[Bear Beat] ${title}`;
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        Activa hoy y llega con repertorio listo
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>. Si lo tuyo es cabina, esto es para ti:
        video remixes, audios y karaokes organizados para que encuentres r&aacute;pido y descargues solo lo que necesitas.
      </p>
      <div style="margin:14px 0 14px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <ul style="margin:0;padding:0 0 0 18px;color:${COLORS.text};font-size:14px;line-height:1.65;">
          <li>Cat&aacute;logo pensado para cabina en vivo</li>
          <li>Organizado por carpetas (a&ntilde;o/mes/semana/g&eacute;nero)</li>
          <li>Nuevos contenidos cada semana</li>
          <li>Descargas por FTP (FileZilla/Air Explorer) o por web</li>
          <li>Cancela cuando quieras desde Mi cuenta</li>
        </ul>
      </div>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Ver planes' })}
      </div>
      <p style="margin:0 0 0 0;font-size:12px;line-height:1.6;color:${COLORS.muted};">
        Pago seguro &bull; Renovaci&oacute;n autom&aacute;tica &bull; Cancela cuando quieras
      </p>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
        <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
      </p>
    `.trim();

    const text =
      `Hola ${name},\n\n` +
      `Precio simple, catálogo gigante.\n` +
      `Activa hoy y llega con repertorio listo.\n\n` +
      `Ver planes: ${url}\n\n` +
      `Pago seguro. Renovación automática. Cancela cuando quieras.\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Activa hoy y llega con repertorio listo.', contentHtml, unsubscribeUrl }),
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
    const subject = `[Bear Beat] Tu cupón ${pct}% está listo`;

    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        ${escapeHtml(`Tu cupón ${pct}% está listo`)}
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>, te guardamos un cup&oacute;n de <strong>${escapeHtml(pct)}%</strong> para que actives hoy
        y llegues a cabina con repertorio listo.
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
      <div style="margin:0 0 14px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          Lo que ganas al activar
        </div>
        <ul style="margin:10px 0 0 18px;padding:0;color:${COLORS.text};font-size:14px;line-height:1.65;">
          <li>Cat&aacute;logo pensado para cabina (video remixes, audios y karaokes)</li>
          <li>Organizado por carpetas para buscar r&aacute;pido</li>
          <li>Descargas por FTP (recomendado) o por web</li>
        </ul>
      </div>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: `Activar con ${pct}%` })}
      </div>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Normalmente se aplica autom&aacute;ticamente al entrar con tu cuenta. Si te lo pide, pega el c&oacute;digo en el checkout.
      </p>
      <p style="margin:12px 0 0 0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
      </p>
    `.trim();

    const text =
      `Tu cupón ${pct}% está listo\n\n` +
      `Hola ${name}, te guardamos un cupón de ${pct}% para que actives hoy.\n\n` +
      `Código: ${safeCoupon}\n` +
      `Válido hasta: ${expiresAt}\n\n` +
      `Activar: ${url}\n\n` +
      `Normalmente se aplica automático. Si te lo pide, pega el código en el checkout.\n`;

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

  winbackLapsedOffer: (params: {
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
    const subject = `[Bear Beat] Regresa con ${pct}% (por tiempo limitado)`;

    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        ${escapeHtml(`Te guardamos ${pct}% para volver`)}
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>. Tu acceso ya no est&aacute; activo, pero te dejamos un cup&oacute;n personal para que vuelvas
        hoy y descargues lo que necesitas para tu set (sin estar improvisando en cabina).
      </p>
      <div style="margin:14px 0 12px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-family:${FONT_MONO};font-size:12px;color:${COLORS.muted};margin-bottom:8px;">
          C&oacute;digo personal
        </div>
        <div style="font-family:${FONT_MONO};font-size:20px;font-weight:950;letter-spacing:0.08em;color:${COLORS.ink};">
          ${escapeHtml(safeCoupon)}
        </div>
        <div style="margin-top:10px;font-size:12px;color:${COLORS.muted};line-height:1.5;">
          V&aacute;lido hasta: <strong style="color:${COLORS.ink};">${escapeHtml(expiresAt)}</strong>
        </div>
      </div>
      <div style="margin:0 0 14px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          Vuelve y gana esto
        </div>
        <ul style="margin:10px 0 0 18px;padding:0;color:${COLORS.text};font-size:14px;line-height:1.65;">
          <li>Video remixes, audios y karaokes listos para cabina</li>
          <li>Organizado por carpetas para encontrar r&aacute;pido</li>
          <li>Descargas por FTP (recomendado) o por web</li>
          <li>Pago seguro &bull; Cancela cuando quieras</li>
        </ul>
      </div>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: `Reactivar con ${pct}%` })}
      </div>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Normalmente se aplica autom&aacute;ticamente al entrar con tu cuenta. Si te lo pide, pega el c&oacute;digo en el checkout.
      </p>
      <p style="margin:12px 0 0 0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
      </p>
    `.trim();

    const text =
      `Te guardamos ${pct}% para volver\n\n` +
      `Hola ${name}. Tu acceso ya no está activo, pero te dejamos un cupón personal por tiempo limitado.\n\n` +
      `Código: ${safeCoupon}\n` +
      `Válido hasta: ${expiresAt}\n\n` +
      `Reactivar: ${url}\n\n` +
      `Normalmente se aplica automático. Si te lo pide, pega el código en el checkout.\n`;

    return {
      subject,
      html: renderLayout({
        title: subject,
        preheader: `Cupón personal ${pct}% por tiempo limitado`,
        contentHtml,
        unsubscribeUrl,
      }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  registeredNoPurchaseOffer: (params: {
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
    const subject = `[Bear Beat] Activa hoy con ${pct}% (cupón personal)`;

    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        ${escapeHtml(`Tu cupón ${pct}% para activar hoy`)}
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>. Vimos que te registraste pero no activaste.
        Si haces cabina, esto te ahorra horas: un cat&aacute;logo gigante (video remixes, audios y karaokes) organizado por carpetas para encontrar r&aacute;pido.
      </p>
      <div style="margin:14px 0 12px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-family:${FONT_MONO};font-size:12px;color:${COLORS.muted};margin-bottom:8px;">
          C&oacute;digo
        </div>
        <div style="font-family:${FONT_MONO};font-size:20px;font-weight:950;letter-spacing:0.08em;color:${COLORS.ink};">
          ${escapeHtml(safeCoupon)}
        </div>
        <div style="margin-top:10px;font-size:12px;color:${COLORS.muted};line-height:1.5;">
          V&aacute;lido hasta: <strong style="color:${COLORS.ink};">${escapeHtml(expiresAt)}</strong>
        </div>
      </div>
      <div style="margin:0 0 14px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          Por qu&eacute; te conviene
        </div>
        <ul style="margin:10px 0 0 18px;padding:0;color:${COLORS.text};font-size:14px;line-height:1.65;">
          <li>Carpetas por a&ntilde;o/mes/semana/g&eacute;nero</li>
          <li>FTP recomendado para bajar r&aacute;pido y sin fallas</li>
          <li>Nuevos contenidos cada semana</li>
          <li>Cancela cuando quieras</li>
        </ul>
      </div>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: `Ver planes y activar (${pct}%)` })}
      </div>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Normalmente se aplica autom&aacute;ticamente al entrar con tu cuenta. Si te lo pide, pega el c&oacute;digo en el checkout.
      </p>
      <p style="margin:12px 0 0 0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
      </p>
    `.trim();

    const text =
      `Tu cupón ${pct}% para activar hoy\n\n` +
      `Hola ${name}. Vimos que te registraste pero no activaste.\n\n` +
      `Código: ${safeCoupon}\n` +
      `Válido hasta: ${expiresAt}\n\n` +
      `Ver planes y activar: ${url}\n\n` +
      `Normalmente se aplica automático. Si te lo pide, pega el código en el checkout.\n`;

    return {
      subject,
      html: renderLayout({
        title: subject,
        preheader: `Cupón ${pct}% para activar hoy`,
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
      <h1 style="margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        Falta 1 paso para descargar
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>, para habilitar descargas necesitamos verificar tu WhatsApp.
        Es r&aacute;pido y nos ayuda a proteger tu cuenta y darte soporte.
      </p>
      <div style="margin:14px 0 14px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          En 3 pasos
        </div>
        <ol style="margin:10px 0 0 18px;padding:0;color:${COLORS.text};font-size:14px;line-height:1.65;">
          <li>Entra a Mi cuenta.</li>
          <li>Agrega tu n&uacute;mero.</li>
          <li>Te llega el c&oacute;digo por WhatsApp (o SMS si WhatsApp falla).</li>
        </ol>
      </div>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Verificar ahora' })}
      </div>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Si ya lo hiciste y a&uacute;n no te deja descargar, revisa que el n&uacute;mero sea correcto y vuelve a intentar.
      </p>
    `.trim();

    const text =
      `Falta 1 paso para descargar\n\n` +
      `Hola ${name}, para habilitar descargas necesitamos verificar tu WhatsApp.\n` +
      `Es rápido y ayuda a proteger tu cuenta.\n\n` +
      `Mi cuenta: ${url}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Verifica tu WhatsApp y habilita descargas.', contentHtml }),
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
      <h1 style="margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        Te quedaste a un paso
      </h1>
      <p style="margin:0 0 10px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>, vimos que intentaste activar tu acceso pero no se complet&oacute;.
        Si lo terminas hoy, llegas a cabina con repertorio listo (sin depender del WiFi del lugar).
      </p>
      ${planLine}
      <div style="margin:14px 0 14px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          Lo que obtienes al activar
        </div>
        <ul style="margin:10px 0 0 18px;padding:0;color:${COLORS.text};font-size:14px;line-height:1.65;">
          <li>Cat&aacute;logo pensado para cabina (video remixes, audios y karaokes)</li>
          <li>Carpetas organizadas para buscar r&aacute;pido</li>
          <li>Descargas por FTP (recomendado) o por web</li>
          <li>Cancela cuando quieras desde Mi cuenta</li>
        </ul>
      </div>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Continuar compra' })}
      </div>
      <div style="margin:14px 0 0 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          Tip rápido
        </div>
        <div style="margin-top:8px;font-size:13px;line-height:1.65;color:${COLORS.text};">
          Si estabas en el celular, prueba con otro m&eacute;todo (tarjeta, PayPal, SPEI u OXXO seg&uacute;n tu plan/moneda) y se activa al confirmar.
        </div>
      </div>
      <p style="margin:12px 0 0 0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
      </p>
    `.trim();

    const text =
      `Te quedaste a un paso\n\n` +
      `Hola ${name}, vimos que intentaste activar tu acceso pero no se completó.\n` +
      `Completa la activación y llega a cabina con repertorio listo.\n` +
      (planName ? `Plan: ${planName}${price ? ` · ${price} ${currency || ''}` : ''}\n\n` : '\n') +
      `Continuar: ${url}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Completa tu activación y descarga hoy.', contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  automationTrialExpiring24h: (params: { name: string; url: string; unsubscribeUrl?: string }) => {
    const { name, url, unsubscribeUrl } = params;
    const subject = `[Bear Beat] Tu prueba termina en 24h`;
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        Tu prueba termina en 24h
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>. Si quieres seguir descargando sin interrupciones, activa tu plan hoy.
        Es la forma m&aacute;s r&aacute;pida de llegar a cabina con repertorio listo.
      </p>
      <div style="margin:14px 0 14px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          Por qu&eacute; vale la pena
        </div>
        <ul style="margin:10px 0 0 18px;padding:0;color:${COLORS.text};font-size:14px;line-height:1.65;">
          <li>Cat&aacute;logo pensado para cabina (video remixes, audios y karaokes)</li>
          <li>Organizado por carpetas para encontrar r&aacute;pido</li>
          <li>FTP recomendado para descargas grandes</li>
          <li>Cancela cuando quieras desde Mi cuenta</li>
        </ul>
      </div>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Ver planes' })}
      </div>
      <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Recuerda: para descargar necesitas verificar tu WhatsApp (1 minuto) desde Mi cuenta.
      </p>
    `.trim();

    const text =
      `Tu prueba termina en 24h\n\n` +
      `Hola ${name}. Si quieres seguir descargando sin interrupciones, activa tu plan hoy:\n${url}\n\n` +
      `Tip: para descargar necesitas verificar tu WhatsApp desde Mi cuenta.\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Últimas 24h de prueba. Activa hoy.', contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  automationActiveNoDownload: (params: { name: string; url: string; days: number; unsubscribeUrl?: string }) => {
    const { name, url, days, unsubscribeUrl } = params;
    const safeDays = Math.max(1, Math.min(60, Math.floor(Number(days) || 0)));
    const subject = `[Bear Beat] Llevas ${safeDays} días sin descargar`;
    const instructionsUrl = appendQueryParams(`${resolveClientUrl()}/instrucciones`, {
      utm_source: 'email',
      utm_medium: 'automation',
      utm_campaign: `active_no_download_${safeDays}d`,
      utm_content: 'link_instructions',
    });
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:26px;line-height:1.16;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
        Vuelve a descargar hoy
      </h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:${COLORS.text};">
        Hola <strong>${escapeHtml(name)}</strong>. Llevas <strong>${escapeHtml(safeDays)}</strong> días sin descargar.
        Entra y revisa las carpetas: seguro ya hay material listo para tu set.
      </p>
      <div style="margin:14px 0 14px 0;background:${COLORS.cardSoft};border:1px solid ${COLORS.border};border-radius:14px;padding:14px;">
        <div style="font-size:12px;line-height:1.3;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
          Ideas r&aacute;pidas
        </div>
        <ul style="margin:10px 0 0 18px;padding:0;color:${COLORS.text};font-size:14px;line-height:1.65;">
          <li>Busca por carpeta (a&ntilde;o/mes/semana/g&eacute;nero) y arma tu repertorio</li>
          <li>Para descargas grandes usa FTP (m&aacute;s estable)</li>
          <li>Gu&iacute;a paso a paso: <a href="${escapeHtml(instructionsUrl)}" style="color:${COLORS.accentInk};text-decoration:underline;text-underline-offset:3px;">/instrucciones</a></li>
        </ul>
      </div>
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
      `Catálogo: ${url}\n` +
      `Guía de descarga (FTP/Web): ${instructionsUrl}\n`;

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
      <h1 style="margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:22px;line-height:1.2;letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};">
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
