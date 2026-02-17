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
  // Email theme: match Bear Beat's *web* design (light surfaces + neon accents).
  // Keep it simple + readable across Gmail/Outlook clients.
  // NOTE: avoid rgba() for text colors; some email clients render it poorly.
  bg: '#F3F7FA',
  card: '#FFFFFF',
  cardSoft: '#F8FBFD',
  border: '#D7E2EE',
  ink: '#0B1220',
  text: '#1F2A3A',
  muted: '#556274',
  dark: '#0B1220',
  cyan: '#08E1F7',
  mint: '#00E6C1',
  accentInk: '#007C89',
  pillBg: '#ECFBFF',
  pillBorder: '#BDEFF7',
} as const;

const FONT_UI = `Manrope, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
const FONT_BRAND = `"Bear-font", Manrope, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
const FONT_MONO =
  `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;

const LINK_STYLE = `color:${COLORS.accentInk};text-decoration:underline;text-underline-offset:3px;`;

const H1_STYLE =
  `margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:30px;line-height:1.14;` +
  `letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};`;
const H1_STYLE_SM =
  `margin:0 0 10px 0;font-family:${FONT_BRAND};font-size:26px;line-height:1.16;` +
  `letter-spacing:-0.01em;font-weight:950;color:${COLORS.ink};`;
const LEAD_STYLE = `margin:0 0 14px 0;font-family:${FONT_UI};font-size:16px;line-height:1.7;color:${COLORS.text};`;
const P_STYLE = `margin:0 0 14px 0;font-family:${FONT_UI};font-size:15px;line-height:1.7;color:${COLORS.text};`;
const MUTED_STYLE = `margin:0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};`;
const SECTION_LABEL_STYLE =
  `font-family:${FONT_UI};font-size:12px;line-height:1.3;font-weight:900;` +
  `letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.muted};`;

const resolveEmailLogoUrl = (): string => {
  const override = (process.env.EMAIL_LOGO_URL || '').trim();
  if (override) return override;
  // Stored in frontend/public/brand/ so it is served as a real asset (not SPA html).
  return `${resolveClientUrl()}/brand/bearbeat-lockup-black.png`;
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
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
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
                  <td style="border-radius:18px;overflow:hidden;border:1px solid ${COLORS.border};box-shadow:0 18px 46px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(8, 225, 247, 0.08);">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.card}" style="background:${COLORS.card};">
                      <tr>
                        <td height="6" bgcolor="${COLORS.cyan}" style="height:6px;line-height:6px;font-size:0;background:${COLORS.cyan};background-image:linear-gradient(11deg, ${COLORS.mint}, ${COLORS.cyan});">
                          &nbsp;
                        </td>
                      </tr>
                      <tr>
                        <td bgcolor="${COLORS.card}" style="background:${COLORS.card};padding:22px 22px 14px 22px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
                            <tr>
                              <td align="left" style="padding:0;">
                                <a href="${escapeHtml(clientUrl)}" style="text-decoration:none;display:inline-block;">
                                  <img src="${logoUrl}" width="164" alt="Bear Beat" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:164px;" />
                                </a>
                              </td>
                              <td align="right" style="padding:0;font-family:${FONT_UI};font-size:11px;line-height:1.35;color:${COLORS.muted};letter-spacing:0.12em;text-transform:uppercase;">
                                Video remixes · Audios · Karaokes
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
                            <div>Recibes este correo por tu actividad en Bear Beat.</div>
                            ${unsubscribeUrl ? `<div style="padding-top:8px;"><a href="${safeUnsubUrl}" style="color:${COLORS.accentInk};text-decoration:underline;text-underline-offset:3px;">Cancelar promociones</a></div>` : ''}
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

const renderButtonSecondary = (params: { href: string; label: string }): string => {
  const { href, label } = params;
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
      <tr>
        <td align="center" bgcolor="${COLORS.card}" style="border-radius:14px;background:${COLORS.card};border:1px solid ${COLORS.border};">
          <a href="${safeHref}" style="display:inline-block;padding:11px 16px;font-family:${FONT_UI};font-size:15px;line-height:1.2;font-weight:900;letter-spacing:-0.01em;color:${COLORS.accentInk};text-decoration:none;border-radius:14px;">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>
  `.trim();
};

const renderPill = (label: string): string => `
  <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${COLORS.pillBg};border:1px solid ${COLORS.pillBorder};color:${COLORS.accentInk};font-family:${FONT_UI};font-size:11px;line-height:1;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;">
    ${escapeHtml(label)}
  </span>
`.trim();

const renderCard = (params: { innerHtml: string; marginTop?: number; tone?: 'soft' | 'white' }): string => {
  const { innerHtml, marginTop = 14, tone = 'soft' } = params;
  const bg = tone === 'white' ? COLORS.card : COLORS.cardSoft;
  return `
    <div style="margin:${marginTop}px 0 0 0;background:${bg};border:1px solid ${COLORS.border};border-radius:16px;padding:16px;">
      ${innerHtml}
    </div>
  `.trim();
};

const renderChecklist = (items: string[]): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
    ${items
      .map(
        (item) => `
          <tr>
            <td valign="top" style="padding:6px 0 0 0;width:22px;">
              <div style="width:18px;height:18px;border-radius:999px;background:${COLORS.pillBg};border:1px solid ${COLORS.pillBorder};text-align:center;font-family:${FONT_UI};font-size:12px;line-height:18px;font-weight:950;color:${COLORS.accentInk};">
                &#10003;
              </div>
            </td>
            <td valign="top" style="padding:6px 0 0 10px;font-family:${FONT_UI};font-size:15px;line-height:1.6;color:${COLORS.text};">
              ${item}
            </td>
          </tr>
        `,
      )
      .join('')}
  </table>
`.trim();

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
	      <div style="margin:0 0 12px 0;">
	        ${renderPill('Bienvenido')}
	      </div>
	      <h1 style="${H1_STYLE}">
	        ${escapeHtml(safeName)}, tu repertorio se arma en minutos
	      </h1>
	      <p style="${LEAD_STYLE}">
	        En <strong style="color:${COLORS.ink};">Bear Beat</strong> tienes <strong style="color:${COLORS.ink};">video remixes, audios y karaokes</strong>
	        listos para cabina, organizados por carpetas para que busques r&aacute;pido, descargues y llegues seguro a tu evento.
	      </p>
	      ${renderCard({
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Empieza en 3 pasos</div>
	          <div style="margin-top:10px;">
	            ${renderChecklist([
	              `Elige tu plan (activaci&oacute;n inmediata).`,
	              `Verifica tu WhatsApp (desbloquea descargas y soporte).`,
	              `Descarga por FTP (recomendado) o por web.`,
	            ])}
	          </div>
	        `,
	      })}
	      <div style="margin:18px 0 10px 0;">
	        ${renderButton({ href: plansUrl, label: 'Ver planes y activar' })}
	      </div>
	      <div style="margin:10px 0 0 0;">
	        ${renderButtonSecondary({ href: instructionsUrl, label: 'Ver guía de descarga' })}
	      </div>
	      ${renderCard({
	        marginTop: 16,
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Tu cuenta</div>
	          <div style="margin-top:8px;font-family:${FONT_UI};font-size:15px;line-height:1.5;color:${COLORS.ink};">
	            Email: <strong>${escapeHtml(email)}</strong>
	          </div>
	          <div style="margin-top:10px;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	            Verifica WhatsApp desde <a href="${escapeHtml(accountUrl)}" style="${LINK_STYLE}">Mi cuenta</a> (toma 1 minuto).
	          </div>
	        `,
	      })}
	      <p style="margin:14px 0 0 0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Pago seguro &bull; Renovaci&oacute;n autom&aacute;tica &bull; Cancela cuando quieras
	      </p>
	    `.trim();

	    const text =
	      `${safeName}, tu repertorio se arma en minutos\n\n` +
	      `En Bear Beat tienes video remixes, audios y karaokes listos para cabina y organizados por carpetas.\n\n` +
	      `Empieza en 3 pasos:\n` +
	      `1) Ver planes y activar: ${plansUrl}\n` +
	      `2) Verifica tu WhatsApp (Mi cuenta): ${accountUrl}\n` +
	      `3) Guía de descarga (FTP/Web): ${instructionsUrl}\n\n` +
	      `Email registrado: ${email}\n\n` +
	      `Pago seguro. Renovación automática. Cancela cuando quieras.\n`;

	    return {
	      subject,
	      html: renderLayout({
	        title: subject,
	        preheader: 'Activa tu acceso y descarga hoy.',
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
	      <div style="margin:0 0 12px 0;">
	        ${renderPill('Seguridad')}
	      </div>
	      <h1 style="${H1_STYLE_SM}">
	        ${escapeHtml(title)}
	      </h1>
	      <p style="${LEAD_STYLE}">
	        Hola <strong>${escapeHtml(name)}</strong>, recibimos una solicitud para restablecer tu contraseña.
	      </p>
	      <div style="margin:18px 0 12px 0;">
	        ${renderButton({ href: link, label: 'Restablecer contraseña' })}
	      </div>
	      ${renderCard({
	        marginTop: 14,
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Importante</div>
	          <div style="margin-top:10px;font-family:${FONT_UI};font-size:14px;line-height:1.65;color:${COLORS.text};">
	            Este enlace expira en <strong style="color:${COLORS.ink};">1 hora</strong>. Si no fuiste t&uacute;, ignora este correo.
	          </div>
	          <div style="margin-top:10px;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	            Si el bot&oacute;n no funciona, copia y pega este enlace:
	            <div style="margin-top:6px;word-break:break-all;color:${COLORS.ink};font-family:${FONT_MONO};font-size:12px;line-height:1.55;">
	              ${escapeHtml(link)}
	            </div>
	          </div>
	        `,
	      })}
	      <p style="margin:14px 0 0 0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
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
	      <div style="margin:0 0 12px 0;">
	        ${renderPill('Acceso activado')}
	      </div>
	      <h1 style="${H1_STYLE_SM}">
	        ${escapeHtml(title)}
	      </h1>
	      <p style="${LEAD_STYLE}">
	        Hola <strong>${escapeHtml(name)}</strong>, ya puedes entrar al cat&aacute;logo y descargar lo que necesitas para tu set.
	        Lo importante: <strong style="color:${COLORS.ink};">est&aacute; ordenado para encontrar r&aacute;pido</strong>.
	      </p>
	      ${renderCard({
	        marginTop: 14,
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Resumen de tu compra</div>
	          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:6px;">
	            <tr>
	              <td style="padding:8px 0;font-family:${FONT_UI};font-size:13px;line-height:1.55;color:${COLORS.muted};">Plan</td>
	              <td style="padding:8px 0;font-family:${FONT_UI};font-size:13px;line-height:1.55;color:${COLORS.ink};text-align:right;font-weight:950;">${escapeHtml(planName)}</td>
	            </tr>
	            <tr>
	              <td style="padding:8px 0;font-family:${FONT_UI};font-size:13px;line-height:1.55;color:${COLORS.muted};">Precio</td>
	              <td style="padding:8px 0;font-family:${FONT_UI};font-size:13px;line-height:1.55;color:${COLORS.ink};text-align:right;font-weight:950;">${escapeHtml(price)} ${escapeHtml(currency)}</td>
	            </tr>
	            <tr>
	              <td style="padding:8px 0;font-family:${FONT_UI};font-size:13px;line-height:1.55;color:${COLORS.muted};">Orden</td>
	              <td style="padding:8px 0;font-family:${FONT_UI};font-size:13px;line-height:1.55;color:${COLORS.ink};text-align:right;font-weight:950;">#${escapeHtml(orderId)}</td>
	            </tr>
	          </table>
	        `,
	      })}
	      ${renderCard({
	        marginTop: 14,
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Para descargar sin fallas</div>
	          <div style="margin-top:10px;">
	            ${renderChecklist([
	              `Entra al cat&aacute;logo y elige tu carpeta (a&ntilde;o/mes/semana/g&eacute;nero).`,
	              `Para carpetas grandes usa FTP (FileZilla/Air Explorer).`,
	              `Importa a tu software y listo.`,
	            ])}
	          </div>
	        `,
	      })}
	      <div style="margin:18px 0 0 0;">
	        ${renderButton({ href: catalogUrl, label: 'Ir al catálogo' })}
	      </div>
	      <p style="margin:14px 0 0 0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Gu&iacute;a de descarga: <a href="${escapeHtml(instructionsUrl)}" style="${LINK_STYLE}">/instrucciones</a>
	        &nbsp;&bull;&nbsp;
	        Cancela/gestiona renovaci&oacute;n desde <a href="${escapeHtml(accountUrl)}" style="${LINK_STYLE}">Mi cuenta</a>.
	      </p>
	      <p style="margin:10px 0 0 0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
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

  cancellationConfirmed: (params: {
    name: string;
    planName: string;
    accessUntil: string;
    accountUrl: string;
    reactivateUrl: string;
  }) => {
    const { name, planName, accessUntil, accountUrl, reactivateUrl } = params;
    const safeName = String(name || '').trim() || 'DJ';
    const title = 'Cancelacion confirmada';
    const subject = `[Bear Beat] ${title}`;

    const contentHtml = `
      <div style="margin:0 0 12px 0;">
        ${renderPill('Suscripcion')}
      </div>
      <h1 style="${H1_STYLE_SM}">
        ${escapeHtml(title)}
      </h1>
      <p style="${LEAD_STYLE}">
        Hola <strong>${escapeHtml(safeName)}</strong>. Tu cancelacion fue registrada.
        Vas a conservar el acceso hasta el fin de tu periodo pagado.
      </p>
      ${renderCard({
        marginTop: 14,
        innerHtml: `
          <div style="${SECTION_LABEL_STYLE}">Detalle</div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:6px;">
            <tr>
              <td style="padding:8px 0;font-family:${FONT_UI};font-size:13px;line-height:1.55;color:${COLORS.muted};">Plan</td>
              <td style="padding:8px 0;font-family:${FONT_UI};font-size:13px;line-height:1.55;color:${COLORS.ink};text-align:right;font-weight:950;">${escapeHtml(planName)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-family:${FONT_UI};font-size:13px;line-height:1.55;color:${COLORS.muted};">Acceso hasta</td>
              <td style="padding:8px 0;font-family:${FONT_UI};font-size:13px;line-height:1.55;color:${COLORS.ink};text-align:right;font-weight:950;">${escapeHtml(accessUntil)}</td>
            </tr>
          </table>
        `,
      })}
      <div style="margin:18px 0 10px 0;">
        ${renderButton({ href: reactivateUrl, label: 'Reactivar' })}
      </div>
      <p style="margin:0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Puedes gestionar tu cuenta en cualquier momento desde <a href="${escapeHtml(accountUrl)}" style="${LINK_STYLE}">Mi cuenta</a>.
      </p>
    `.trim();

    const text =
      `Cancelacion confirmada\n\n` +
      `Hola ${safeName}. Tu cancelacion fue registrada.\n` +
      `Plan: ${planName}\n` +
      `Acceso hasta: ${accessUntil}\n\n` +
      `Reactivar: ${reactivateUrl}\n` +
      `Mi cuenta: ${accountUrl}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: `Acceso hasta ${accessUntil}`, contentHtml }),
      text,
    };
  },

  cancellationEndingSoon: (params: {
    name: string;
    accessUntil: string;
    accountUrl: string;
    reactivateUrl: string;
  }) => {
    const { name, accessUntil, accountUrl, reactivateUrl } = params;
    const safeName = String(name || '').trim() || 'DJ';
    const title = 'Tu acceso termina pronto';
    const subject = `[Bear Beat] ${title}`;

    const contentHtml = `
      <div style="margin:0 0 12px 0;">
        ${renderPill('Recordatorio')}
      </div>
      <h1 style="${H1_STYLE_SM}">
        ${escapeHtml(title)}
      </h1>
      <p style="${LEAD_STYLE}">
        Hola <strong>${escapeHtml(safeName)}</strong>. Tu acceso a Bear Beat termina el
        <strong style="color:${COLORS.ink};">${escapeHtml(accessUntil)}</strong>.
        Si quieres seguir descargando sin interrupciones, reactiva hoy.
      </p>
      ${renderCard({
        marginTop: 14,
        innerHtml: `
          <div style="${SECTION_LABEL_STYLE}">Para evitar interrupciones</div>
          <div style="margin-top:10px;">
            ${renderChecklist([
              'Reactiva tu membresia.',
              'Verifica tu WhatsApp si aun no lo hiciste.',
              'Descarga por FTP para carpetas grandes.',
            ])}
          </div>
        `,
      })}
      <div style="margin:18px 0 10px 0;">
        ${renderButton({ href: reactivateUrl, label: 'Reactivar ahora' })}
      </div>
      <p style="margin:0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Mi cuenta: <a href="${escapeHtml(accountUrl)}" style="${LINK_STYLE}">suscripcion / soporte</a>
      </p>
    `.trim();

    const text =
      `Tu acceso termina pronto\n\n` +
      `Hola ${safeName}. Tu acceso termina el ${accessUntil}.\n\n` +
      `Reactivar: ${reactivateUrl}\n` +
      `Mi cuenta: ${accountUrl}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: `Termina el ${accessUntil}`, contentHtml }),
      text,
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
	      <div style="margin:0 0 12px 0;">
	        ${renderPill('Tu prueba está activa')}
	      </div>
	      <h1 style="${H1_STYLE_SM}">
	        Haz tu primera descarga hoy
	      </h1>
	      <p style="${LEAD_STYLE}">
	        Hola <strong>${escapeHtml(name)}</strong>. Para que lo sientas de inmediato: descarga 10-20 tracks y pruébalos en tu set.
	        Todo est&aacute; organizado por carpetas para que encuentres r&aacute;pido.
	      </p>
	      ${renderCard({
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">En 3 pasos</div>
	          <div style="margin-top:10px;">
	            ${renderChecklist([
	              `Entra al cat&aacute;logo.`,
	              `Busca tu carpeta (a&ntilde;o/mes/semana/g&eacute;nero).`,
	              `Descarga por FTP (recomendado) o por web.`,
	            ])}
	          </div>
	        `,
	      })}
	      <div style="margin:18px 0 10px 0;">
	        ${renderButton({ href: url, label: 'Abrir catálogo' })}
	      </div>
	      <p style="margin:0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Gu&iacute;a de descarga: <a href="${escapeHtml(instructionsUrl)}" style="${LINK_STYLE}">/instrucciones</a>
	        &nbsp;&bull;&nbsp;
	        WhatsApp (para habilitar descargas): <a href="${escapeHtml(accountUrl)}" style="${LINK_STYLE}">Mi cuenta</a>
	      </p>
	      <p style="margin:12px 0 0 0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
	      </p>
	    `.trim();

	    const text =
	      `Hola ${name},\n\n` +
	      `Tu prueba está activa. Haz tu primera descarga hoy:\n` +
	      `1) Abrir catálogo: ${url}\n` +
	      `2) Busca por carpetas (año/mes/semana/género)\n` +
	      `3) Descarga por FTP (recomendado): ${instructionsUrl}\n\n` +
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
	      <div style="margin:0 0 12px 0;">
	        ${renderPill('Acceso activo')}
	      </div>
	      <h1 style="${H1_STYLE_SM}">
	        ${escapeHtml('Descarga hoy (y ah&oacute;rrate horas)')}
	      </h1>
	      <p style="${LEAD_STYLE}">
	        Hola <strong>${escapeHtml(name)}</strong>. Tu acceso est&aacute; activo. Entra al cat&aacute;logo y baja lo que necesitas para tu evento:
	        est&aacute; organizado por carpetas para que encuentres r&aacute;pido.
	      </p>
	      ${renderCard({
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Para ir r&aacute;pido</div>
	          <div style="margin-top:10px;">
	            ${renderChecklist([
	              `Carpetas por a&ntilde;o/mes/semana/g&eacute;nero.`,
	              `FTP (FileZilla/Air Explorer) recomendado para descargas grandes.`,
	              `Cancela cuando quieras desde Mi cuenta.`,
	            ])}
	          </div>
	        `,
	      })}
	      <div style="margin:18px 0 10px 0;">
	        ${renderButton({ href: url, label: 'Ir al catálogo' })}
	      </div>
	      <p style="margin:0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Gu&iacute;a de descarga: <a href="${escapeHtml(instructionsUrl)}" style="${LINK_STYLE}">/instrucciones</a>
	        &nbsp;&bull;&nbsp;
	        Mi cuenta: <a href="${escapeHtml(accountUrl)}" style="${LINK_STYLE}">suscripci&oacute;n / soporte</a>
	      </p>
	      <p style="margin:12px 0 0 0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
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

  automationPaidNoDownload2h: (params: {
    name: string;
    instructionsUrl: string;
    catalogUrl: string;
    recommendedFolder?: string | null;
    unsubscribeUrl?: string;
  }) => {
    const { name, instructionsUrl, catalogUrl, recommendedFolder, unsubscribeUrl } = params;
    const safeRecommendedFolder = String(recommendedFolder || 'Semana').trim() || 'Semana';
    const subject = `[Bear Beat] Haz tu primera descarga hoy`;

    const contentHtml = `
      <div style="margin:0 0 12px 0;">
        ${renderPill('Primeras 2 horas')}
      </div>
      <h1 style="${H1_STYLE_SM}">
        Empieza en 3 pasos (menos de 5 min)
      </h1>
      <p style="${LEAD_STYLE}">
        Hola <strong>${escapeHtml(name)}</strong>. Ya tienes acceso activo. Te recomendamos empezar por
        la carpeta <strong style="color:${COLORS.ink};">${escapeHtml(safeRecommendedFolder)}</strong> y bajar tu primer bloque ahora.
      </p>
      ${renderCard({
        innerHtml: `
          <div style="${SECTION_LABEL_STYLE}">Ruta r&aacute;pida</div>
          <div style="margin-top:10px;">
            ${renderChecklist([
              `Abre la gu&iacute;a de descarga (/instrucciones).`,
              `Empieza por la carpeta: <strong style="color:${COLORS.ink};">${escapeHtml(safeRecommendedFolder)}</strong>.`,
              `Si vas a bajar mucho material, usa FTP (FileZilla/Air Explorer).`,
            ])}
          </div>
        `,
      })}
      <div style="margin:18px 0 10px 0;">
        ${renderButton({ href: instructionsUrl, label: 'Abrir /instrucciones' })}
      </div>
      <div style="margin:10px 0 0 0;">
        ${renderButtonSecondary({ href: catalogUrl, label: 'Ir al catálogo' })}
      </div>
      <p style="margin:12px 0 0 0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Gu&iacute;a: <a href="${escapeHtml(instructionsUrl)}" style="${LINK_STYLE}">/instrucciones</a>
        &nbsp;&bull;&nbsp;
        Cat&aacute;logo: <a href="${escapeHtml(catalogUrl)}" style="${LINK_STYLE}">abrir</a>
      </p>
    `.trim();

    const text =
      `Haz tu primera descarga hoy\n\n` +
      `Hola ${name}. Tu acceso ya esta activo.\n` +
      `Empieza por la carpeta recomendada: ${safeRecommendedFolder}\n\n` +
      `Guia de descarga: ${instructionsUrl}\n` +
      `Catalogo: ${catalogUrl}\n`;

    return {
      subject,
      html: renderLayout({
        title: subject,
        preheader: 'Empieza con una carpeta recomendada y descarga hoy.',
        contentHtml,
        unsubscribeUrl,
      }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

	  automationRegisteredNoPurchase7d: (params: { name: string; url: string; unsubscribeUrl?: string }) => {
	    const { name, url, unsubscribeUrl } = params;
	    const title = 'Precio simple, catálogo gigante';
	    const subject = `[Bear Beat] ${title}`;
	    const contentHtml = `
	      <div style="margin:0 0 12px 0;">
	        ${renderPill('Para cabina')}
	      </div>
	      <h1 style="${H1_STYLE_SM}">
	        Activa y deja de improvisar repertorio
	      </h1>
	      <p style="${LEAD_STYLE}">
	        Hola <strong>${escapeHtml(name)}</strong>. Si haces cabina, Bear Beat te ahorra tiempo:
	        <strong style="color:${COLORS.ink};">encuentras r&aacute;pido</strong>, descargas y sales con set listo.
	      </p>
	      ${renderCard({
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Lo que te llevas</div>
	          <div style="margin-top:10px;">
	            ${renderChecklist([
	              `Cat&aacute;logo pensado para cabina: video remixes, audios y karaokes.`,
	              `Carpetas por a&ntilde;o/mes/semana/g&eacute;nero (cero caos).`,
	              `Actualizaciones frecuentes.`,
	              `Descarga por FTP (recomendado) o por web.`,
	              `Cancela cuando quieras desde Mi cuenta.`,
	            ])}
	          </div>
	        `,
	      })}
	      <div style="margin:18px 0 10px 0;">
	        ${renderButton({ href: url, label: 'Ver planes' })}
	      </div>
	      <p style="margin:0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Pago seguro &bull; Renovaci&oacute;n autom&aacute;tica &bull; Cancela cuando quieras
	      </p>
	      <p style="margin:10px 0 0 0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
	      </p>
	    `.trim();

	    const text =
	      `Hola ${name},\n\n` +
	      `Activa y deja de improvisar repertorio.\n` +
	      `Bear Beat te ahorra tiempo: encuentras rápido, descargas y sales con set listo.\n\n` +
	      `Ver planes: ${url}\n\n` +
	      `Pago seguro. Renovación automática. Cancela cuando quieras.\n`;

	    return {
	      subject,
	      html: renderLayout({ title: subject, preheader: 'Activa hoy y llega con set listo.', contentHtml, unsubscribeUrl }),
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
	      <div style="margin:0 0 12px 0;">
	        ${renderPill('Cup&oacute;n personal')}
	      </div>
	      <h1 style="${H1_STYLE_SM}">
	        ${escapeHtml(`Ahorra ${pct}% y activa hoy`)}
	      </h1>
	      <p style="${LEAD_STYLE}">
	        Hola <strong>${escapeHtml(name)}</strong>, te guardamos un cup&oacute;n de <strong style="color:${COLORS.ink};">${escapeHtml(pct)}%</strong>
	        para que actives hoy y llegues a cabina con repertorio listo.
	      </p>
	      ${renderCard({
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Tu c&oacute;digo</div>
	          <div style="margin-top:10px;font-family:${FONT_MONO};font-size:22px;font-weight:950;letter-spacing:0.08em;color:${COLORS.ink};">
	            ${escapeHtml(safeCoupon)}
	          </div>
	          <div style="margin-top:10px;font-family:${FONT_UI};font-size:13px;line-height:1.6;color:${COLORS.muted};">
	            V&aacute;lido hasta: <strong style="color:${COLORS.ink};">${escapeHtml(expiresAt)}</strong>
	          </div>
	        `,
	      })}
	      ${renderCard({
	        marginTop: 14,
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Por qu&eacute; conviene</div>
	          <div style="margin-top:10px;">
	            ${renderChecklist([
	              `Cat&aacute;logo pensado para cabina: video remixes, audios y karaokes.`,
	              `Organizado por carpetas para buscar r&aacute;pido.`,
	              `FTP recomendado para descargas grandes.`,
	            ])}
	          </div>
	        `,
	      })}
	      <div style="margin:18px 0 10px 0;">
	        ${renderButton({ href: url, label: `Activar con ${pct}%` })}
	      </div>
	      <p style="margin:0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Normalmente se aplica autom&aacute;ticamente al entrar con tu cuenta. Si te lo pide, pega el c&oacute;digo en el checkout.
	      </p>
	      <p style="margin:10px 0 0 0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
	      </p>
	    `.trim();

	    const text =
	      `Ahorra ${pct}% y activa hoy\n\n` +
	      `Hola ${name}, te guardamos un cupón personal de ${pct}%.\n\n` +
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
	      <div style="margin:0 0 12px 0;">
	        ${renderPill('Te extrañamos')}
	      </div>
	      <h1 style="${H1_STYLE_SM}">
	        ${escapeHtml(`Vuelve con ${pct}% y arma tu set sin estr\u00e9s`)}
	      </h1>
	      <p style="${LEAD_STYLE}">
	        Hola <strong>${escapeHtml(name)}</strong>. Tu acceso ya no est&aacute; activo, pero te dejamos un cup&oacute;n personal por tiempo limitado
	        para que regreses cuando lo necesites y descargues lo esencial para tu cabina.
	      </p>
	      ${renderCard({
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Tu c&oacute;digo personal</div>
	          <div style="margin-top:10px;font-family:${FONT_MONO};font-size:22px;font-weight:950;letter-spacing:0.08em;color:${COLORS.ink};">
	            ${escapeHtml(safeCoupon)}
	          </div>
	          <div style="margin-top:10px;font-family:${FONT_UI};font-size:13px;line-height:1.6;color:${COLORS.muted};">
	            V&aacute;lido hasta: <strong style="color:${COLORS.ink};">${escapeHtml(expiresAt)}</strong>
	          </div>
	        `,
	      })}
	      ${renderCard({
	        marginTop: 14,
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Por qu&eacute; volver</div>
	          <div style="margin-top:10px;">
	            ${renderChecklist([
	              `Video remixes, audios y karaokes listos para cabina.`,
	              `Carpetas organizadas para encontrar r&aacute;pido.`,
	              `FTP recomendado para bajar sin fallas.`,
	              `Pago seguro &bull; Cancela cuando quieras.`,
	            ])}
	          </div>
	        `,
	      })}
	      <div style="margin:18px 0 10px 0;">
	        ${renderButton({ href: url, label: `Reactivar con ${pct}%` })}
	      </div>
	      <p style="margin:0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Normalmente se aplica autom&aacute;ticamente al entrar con tu cuenta. Si te lo pide, pega el c&oacute;digo en el checkout.
	      </p>
	      <p style="margin:10px 0 0 0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
	      </p>
	    `.trim();

	    const text =
	      `Vuelve con ${pct}% (por tiempo limitado)\n\n` +
	      `Hola ${name}. Te dejamos un cupón personal para que regreses cuando lo necesites.\n\n` +
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
	      <div style="margin:0 0 12px 0;">
	        ${renderPill('Cupón personal')}
	      </div>
	      <h1 style="${H1_STYLE_SM}">
	        ${escapeHtml(`Tu ${pct}% est\u00e1 guardado (activa hoy)`)}
	      </h1>
	      <p style="${LEAD_STYLE}">
	        Hola <strong>${escapeHtml(name)}</strong>. Vimos que te registraste pero no activaste.
	        Si haces cabina, esto es simple: <strong style="color:${COLORS.ink};">menos b\u00fasqueda</strong>, m\u00e1s set listo.
	      </p>
	      ${renderCard({
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Tu c&oacute;digo</div>
	          <div style="margin-top:10px;font-family:${FONT_MONO};font-size:22px;font-weight:950;letter-spacing:0.08em;color:${COLORS.ink};">
	            ${escapeHtml(safeCoupon)}
	          </div>
	          <div style="margin-top:10px;font-family:${FONT_UI};font-size:13px;line-height:1.6;color:${COLORS.muted};">
	            V&aacute;lido hasta: <strong style="color:${COLORS.ink};">${escapeHtml(expiresAt)}</strong>
	          </div>
	        `,
	      })}
	      ${renderCard({
	        marginTop: 14,
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Lo que cambia al activar</div>
	          <div style="margin-top:10px;">
	            ${renderChecklist([
	              `Carpetas por a&ntilde;o/mes/semana/g&eacute;nero.`,
	              `FTP recomendado para bajar r&aacute;pido y sin fallas.`,
	              `Actualizaciones frecuentes.`,
	              `Cancela cuando quieras.`,
	            ])}
	          </div>
	        `,
	      })}
	      <div style="margin:18px 0 10px 0;">
	        ${renderButton({ href: url, label: `Ver planes y activar (${pct}%)` })}
	      </div>
	      <p style="margin:0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Normalmente se aplica autom&aacute;ticamente al entrar con tu cuenta. Si te lo pide, pega el c&oacute;digo en el checkout.
	      </p>
	      <p style="margin:10px 0 0 0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
	      </p>
	    `.trim();

	    const text =
	      `Tu ${pct}% está guardado (activa hoy)\n\n` +
	      `Hola ${name}. Vimos que te registraste pero no activaste.\n` +
	      `Menos búsqueda, más set listo.\n\n` +
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
      <div style="margin:0 0 12px 0;">
        ${renderPill('Verificación')}
      </div>
      <h1 style="${H1_STYLE_SM}">
        Falta 1 paso para descargar
      </h1>
      <p style="${LEAD_STYLE}">
        Hola <strong>${escapeHtml(name)}</strong>, para habilitar descargas necesitamos verificar tu WhatsApp.
        Es r&aacute;pido y nos ayuda a proteger tu cuenta y darte soporte.
      </p>
      ${renderCard({
        innerHtml: `
          <div style="${SECTION_LABEL_STYLE}">En 3 pasos</div>
          <div style="margin-top:10px;">
            ${renderChecklist([
              `Entra a Mi cuenta.`,
              `Agrega tu n&uacute;mero.`,
              `Te llega el c&oacute;digo por WhatsApp (o SMS si WhatsApp falla).`,
            ])}
          </div>
        `,
      })}
      <div style="margin:18px 0 10px 0;">
        ${renderButton({ href: url, label: 'Verificar ahora' })}
      </div>
      <p style="margin:0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
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
	      <div style="margin:0 0 12px 0;">
	        ${renderPill('Te quedaste a un paso')}
	      </div>
	      <h1 style="${H1_STYLE_SM}">
	        Termina tu activaci&oacute;n en 2 minutos
	      </h1>
	      <p style="${LEAD_STYLE}">
	        Hola <strong>${escapeHtml(name)}</strong>, vimos que intentaste activar tu acceso pero no se complet&oacute;.
	        Si lo terminas hoy, llegas a cabina con repertorio listo (sin depender del WiFi del lugar).
	      </p>
	      ${planLine}
	      ${renderCard({
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Lo que obtienes al activar</div>
	          <div style="margin-top:10px;">
	            ${renderChecklist([
	              `Cat&aacute;logo pensado para cabina: video remixes, audios y karaokes.`,
	              `Carpetas organizadas para buscar r&aacute;pido.`,
	              `Descargas por FTP (recomendado) o por web.`,
	              `Cancela cuando quieras desde Mi cuenta.`,
	            ])}
	          </div>
	        `,
	      })}
	      <div style="margin:18px 0 10px 0;">
	        ${renderButton({ href: url, label: 'Continuar compra' })}
	      </div>
	      ${renderCard({
	        marginTop: 14,
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Tip r&aacute;pido</div>
	          <div style="margin-top:10px;font-family:${FONT_UI};font-size:14px;line-height:1.65;color:${COLORS.text};">
	            Si estabas en el celular, prueba con otro m&eacute;todo (tarjeta, PayPal, SPEI u OXXO seg&uacute;n tu plan/moneda).
	          </div>
	        `,
	      })}
	      <p style="margin:12px 0 0 0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
	      </p>
	    `.trim();

	    const text =
	      `Termina tu activación en 2 minutos\n\n` +
	      `Hola ${name}, vimos que intentaste activar tu acceso pero no se completó.\n` +
	      `Completa la activación y llega a cabina con set listo.\n` +
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
	      <div style="margin:0 0 12px 0;">
	        ${renderPill('Últimas 24h')}
	      </div>
	      <h1 style="${H1_STYLE_SM}">
	        Tu prueba termina en 24h
	      </h1>
	      <p style="${LEAD_STYLE}">
	        Hola <strong>${escapeHtml(name)}</strong>. Si quieres seguir descargando sin interrupciones, activa tu plan hoy.
	        Es la forma m&aacute;s r&aacute;pida de llegar a cabina con repertorio listo.
	      </p>
	      ${renderCard({
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Por qu&eacute; vale la pena</div>
	          <div style="margin-top:10px;">
	            ${renderChecklist([
	              `Cat&aacute;logo pensado para cabina: video remixes, audios y karaokes.`,
	              `Organizado por carpetas para encontrar r&aacute;pido.`,
	              `FTP recomendado para descargas grandes.`,
	              `Cancela cuando quieras desde Mi cuenta.`,
	            ])}
	          </div>
	        `,
	      })}
	      <div style="margin:18px 0 10px 0;">
	        ${renderButton({ href: url, label: 'Ver planes' })}
	      </div>
	      <p style="margin:0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
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
	      <div style="margin:0 0 12px 0;">
	        ${renderPill('Tu acceso sigue activo')}
	      </div>
	      <h1 style="${H1_STYLE_SM}">
	        Hay material listo para tu set
	      </h1>
	      <p style="${LEAD_STYLE}">
	        Hola <strong>${escapeHtml(name)}</strong>. Llevas <strong style="color:${COLORS.ink};">${escapeHtml(safeDays)}</strong> d&iacute;as sin descargar.
	        Entra y revisa las carpetas: seguro hay contenido que te sirve hoy.
	      </p>
	      ${renderCard({
	        innerHtml: `
	          <div style="${SECTION_LABEL_STYLE}">Ideas r&aacute;pidas</div>
	          <div style="margin-top:10px;">
	            ${renderChecklist([
	              `Busca por carpeta (a&ntilde;o/mes/semana/g&eacute;nero) y arma tu repertorio.`,
	              `Para descargas grandes usa FTP (m&aacute;s estable).`,
	              `Gu&iacute;a paso a paso: <a href="${escapeHtml(instructionsUrl)}" style="${LINK_STYLE}">/instrucciones</a>.`,
	            ])}
	          </div>
	        `,
	      })}
	      <div style="margin:18px 0 10px 0;">
	        ${renderButton({ href: url, label: 'Ir al catálogo' })}
	      </div>
	      <p style="margin:0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
	        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(url)}</span>
	      </p>
	    `.trim();

	    const text =
	      `Hay material listo para tu set\n\n` +
	      `Hola ${name}. Llevas ${safeDays} días sin descargar.\n\n` +
	      `Catálogo: ${url}\n` +
	      `Guía de descarga (FTP/Web): ${instructionsUrl}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Tu acceso sigue activo.', contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  dunningPaymentFailed: (params: {
    name: string;
    ctaUrl: string;
    stageDays: 0 | 1 | 3 | 7 | 14;
    accessUntil?: string | null;
    supportUrl?: string | null;
  }) => {
    const { name, ctaUrl, stageDays, accessUntil, supportUrl } = params;
    const safeName = String(name || '').trim() || 'DJ';
    const title =
      stageDays === 0
        ? 'Accion requerida: actualiza tu pago'
        : stageDays === 1
          ? 'Recordatorio: tu pago no paso'
          : stageDays === 3
            ? 'Evita que tu acceso se pause'
            : stageDays === 7
              ? 'Ultimo aviso: actualiza tu pago'
              : 'Tu acceso puede estar pausado';
    const subject = `[Bear Beat] ${title}`;

    const accessLine = accessUntil
      ? `<div style="margin-top:10px;font-family:${FONT_UI};font-size:13px;line-height:1.6;color:${COLORS.muted};">
           Acceso actual: <strong style="color:${COLORS.ink};">hasta ${escapeHtml(accessUntil)}</strong>
         </div>`
      : '';

    const supportLine = supportUrl
      ? `<div style="margin-top:10px;font-family:${FONT_UI};font-size:13px;line-height:1.6;color:${COLORS.muted};">
           Si necesitas ayuda: <a href="${escapeHtml(supportUrl)}" style="${LINK_STYLE}">Soporte</a>
         </div>`
      : '';

    const contentHtml = `
      <div style="margin:0 0 12px 0;">
        ${renderPill('Facturacion')}
      </div>
      <h1 style="${H1_STYLE_SM}">
        ${escapeHtml(title)}
      </h1>
      <p style="${LEAD_STYLE}">
        Hola <strong>${escapeHtml(safeName)}</strong>. Intentamos renovar tu membresia y el pago fue rechazado.
        Para evitar interrupciones, actualiza tu metodo de pago.
      </p>
      ${accessLine}
      ${renderCard({
        marginTop: 14,
        innerHtml: `
          <div style="${SECTION_LABEL_STYLE}">Arreglalo en 1 minuto</div>
          <div style="margin-top:10px;">
            ${renderChecklist([
              'Abre el portal de pagos.',
              'Actualiza tarjeta / metodo.',
              'Listo: tu acceso sigue sin pausas.',
            ])}
          </div>
        `,
      })}
      <div style="margin:18px 0 10px 0;">
        ${renderButton({ href: ctaUrl, label: 'Actualizar pago' })}
      </div>
      ${supportLine}
      <p style="margin:12px 0 0 0;font-family:${FONT_UI};font-size:13px;line-height:1.65;color:${COLORS.muted};">
        Enlace directo: <span style="word-break:break-all;color:${COLORS.ink};">${escapeHtml(ctaUrl)}</span>
      </p>
    `.trim();

    const text =
      `${title}\n\n` +
      `Hola ${safeName}. Intentamos renovar tu membresia y el pago fue rechazado.\n` +
      (accessUntil ? `Acceso actual: hasta ${accessUntil}\n` : '') +
      `\nActualizar pago: ${ctaUrl}\n` +
      (supportUrl ? `Soporte: ${supportUrl}\n` : '');

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Actualiza tu pago para evitar interrupciones.', contentHtml }),
      text,
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
