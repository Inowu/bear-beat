const escapeHtml = (value: unknown): string => {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const renderLayout = (params: { title: string; preheader?: string; contentHtml: string; unsubscribeUrl?: string }): string => {
  const { title, preheader, contentHtml, unsubscribeUrl } = params;
  const safeTitle = escapeHtml(title);
  const safePreheader = preheader ? escapeHtml(preheader) : '';
  const safeUnsubUrl = unsubscribeUrl ? escapeHtml(unsubscribeUrl) : '';

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${safeTitle}</title>
      </head>
      <body style="margin:0;padding:0;background:#f6f8fa;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          ${safePreheader}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fa;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
                <tr>
                  <td style="padding:22px 22px 8px 22px;">
                    <div style="font-family:Arial, sans-serif;font-size:18px;font-weight:700;color:#111;">Bear Beat</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 22px 22px;">
                    ${contentHtml}
                  </td>
                </tr>
              </table>
              <div style="font-family:Arial, sans-serif;color:#6b7280;font-size:12px;line-height:1.4;padding:12px 8px;">
                Si no solicitaste este correo, puedes ignorarlo.
                ${unsubscribeUrl ? `<div style="padding-top:6px;"><a href="${safeUnsubUrl}" style="color:#6b7280;text-decoration:underline;text-underline-offset:3px;">Cancelar promociones</a></div>` : ''}
              </div>
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
  return `
    <a href="${safeHref}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:10px;font-family:Arial, sans-serif;font-weight:700;">
      ${safeLabel}
    </a>
  `.trim();
};

const appendMarketingUnsubscribeText = (text: string, unsubscribeUrl?: string): string => {
  const url = (unsubscribeUrl || '').trim();
  if (!url) return text;
  return `${text}\n\nCancelar promociones: ${url}\n`;
};

export const emailTemplates = {
  welcome: (params: { name: string; email: string; unsubscribeUrl?: string }) => {
    const { name, email, unsubscribeUrl } = params;
    const title = 'Bienvenido a Bear Beat';
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:22px;line-height:1.2;color:#111;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 12px 0;font-family:Arial, sans-serif;color:#111;line-height:1.6;">
        Hola <strong>${escapeHtml(name)}</strong>, tu cuenta ya está lista.
      </p>
      <p style="margin:0 0 0 0;font-family:Arial, sans-serif;color:#374151;line-height:1.6;">
        Email registrado: <strong>${escapeHtml(email)}</strong>
      </p>
    `.trim();

    const text = `Bienvenido a Bear Beat\n\nHola ${name}, tu cuenta ya está lista.\nEmail registrado: ${email}\n`;
    return {
      subject: title,
      html: renderLayout({ title, preheader: 'Tu cuenta ya está lista.', contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  passwordReset: (params: { name: string; email: string; link: string; unsubscribeUrl?: string }) => {
    const { name, email, link, unsubscribeUrl } = params;
    const title = 'Restablece tu contraseña';
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:22px;line-height:1.2;color:#111;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 12px 0;font-family:Arial, sans-serif;color:#111;line-height:1.6;">
        Hola <strong>${escapeHtml(name)}</strong>, recibimos una solicitud para restablecer tu contraseña.
      </p>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: link, label: 'Restablecer contraseña' })}
      </div>
      <p style="margin:0;font-family:Arial, sans-serif;color:#374151;line-height:1.6;font-size:13px;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
        <span style="word-break:break-all;">${escapeHtml(link)}</span>
      </p>
      <p style="margin:14px 0 0 0;font-family:Arial, sans-serif;color:#6b7280;line-height:1.6;font-size:12px;">
        Cuenta: ${escapeHtml(email)}
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

  planActivated: (params: { name: string; planName: string; price: unknown; currency: string; orderId: unknown; unsubscribeUrl?: string }) => {
    const { name, planName, price, currency, orderId, unsubscribeUrl } = params;
    const title = 'Tu plan está activo';
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:22px;line-height:1.2;color:#111;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 12px 0;font-family:Arial, sans-serif;color:#111;line-height:1.6;">
        Hola <strong>${escapeHtml(name)}</strong>, tu suscripción fue activada correctamente.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:10px;">
        <tr>
          <td style="padding:10px 0;font-family:Arial, sans-serif;color:#374151;">Plan</td>
          <td style="padding:10px 0;font-family:Arial, sans-serif;color:#111;text-align:right;font-weight:700;">${escapeHtml(planName)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-family:Arial, sans-serif;color:#374151;">Precio</td>
          <td style="padding:10px 0;font-family:Arial, sans-serif;color:#111;text-align:right;font-weight:700;">${escapeHtml(price)} ${escapeHtml(currency)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-family:Arial, sans-serif;color:#374151;">Orden</td>
          <td style="padding:10px 0;font-family:Arial, sans-serif;color:#111;text-align:right;font-weight:700;">#${escapeHtml(orderId)}</td>
        </tr>
      </table>
      <p style="margin:14px 0 0 0;font-family:Arial, sans-serif;color:#6b7280;line-height:1.6;font-size:12px;">
        Si tienes dudas, responde a este correo o contacta a soporte.
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
      <h1 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:22px;line-height:1.2;color:#111;">${escapeHtml(
        title,
      )}</h1>
      <p style="margin:0 0 12px 0;font-family:Arial, sans-serif;color:#111;line-height:1.6;">
        Hola <strong>${escapeHtml(name)}</strong>, tu prueba sigue activa.
      </p>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Empezar ahora' })}
      </div>
      <p style="margin:0;font-family:Arial, sans-serif;color:#374151;line-height:1.6;font-size:13px;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
        <span style="word-break:break-all;">${escapeHtml(url)}</span>
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
      <h1 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:22px;line-height:1.2;color:#111;">${escapeHtml(
        title,
      )}</h1>
      <p style="margin:0 0 12px 0;font-family:Arial, sans-serif;color:#111;line-height:1.6;">
        Hola <strong>${escapeHtml(name)}</strong>, tu plan está activo.
      </p>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Ir a Bear Beat' })}
      </div>
      <p style="margin:0;font-family:Arial, sans-serif;color:#374151;line-height:1.6;font-size:13px;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
        <span style="word-break:break-all;">${escapeHtml(url)}</span>
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
      <h1 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:22px;line-height:1.2;color:#111;">${escapeHtml(
        title,
      )}</h1>
      <p style="margin:0 0 12px 0;font-family:Arial, sans-serif;color:#111;line-height:1.6;">
        Hola <strong>${escapeHtml(name)}</strong>, aquí puedes elegir tu plan:
      </p>
      <div style="margin:16px 0 14px 0;">
        ${renderButton({ href: url, label: 'Ver planes' })}
      </div>
      <p style="margin:0;font-family:Arial, sans-serif;color:#374151;line-height:1.6;font-size:13px;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
        <span style="word-break:break-all;">${escapeHtml(url)}</span>
      </p>
    `.trim();

    const text = `Hola ${name},\n\nElige tu plan aquí:\n${url}\n`;

    return {
      subject,
      html: renderLayout({ title: subject, preheader: 'Elige tu plan.', contentHtml, unsubscribeUrl }),
      text: appendMarketingUnsubscribeText(text, unsubscribeUrl),
    };
  },

  analyticsAlerts: (params: { days: number; count: number; detailsText: string; generatedAt: string }) => {
    const { days, count, detailsText, generatedAt } = params;
    const subject = `[Bear Beat] Alerts de analytics (${count}) · ${days}d`;
    const contentHtml = `
      <h1 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:22px;line-height:1.2;color:#111;">${escapeHtml(
        subject,
      )}</h1>
      <p style="margin:0 0 12px 0;font-family:Arial, sans-serif;color:#111;line-height:1.6;">
        Ventana: últimos <strong>${escapeHtml(days)}</strong> días.
      </p>
      <pre style="white-space: pre-wrap; background: #f6f8fa; padding: 12px; border-radius: 10px; border: 1px solid #e5e7eb;">${escapeHtml(
        detailsText,
      )}</pre>
      <p style="margin:12px 0 0 0;font-family:Arial, sans-serif;color:#6b7280;line-height:1.6;font-size:12px;">
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
