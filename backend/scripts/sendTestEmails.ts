import path from 'path';
import dotenv from 'dotenv';
import { sendEmail } from '../src/email';
import { emailTemplates } from '../src/email/templates';
import { buildMarketingUnsubscribeUrl } from '../src/comms/unsubscribe';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const resolveClientUrl = (): string =>
  (process.env.CLIENT_URL || 'https://thebearbeat.com').trim().replace(/\/+$/, '');

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

async function main(): Promise<void> {
  const toEmail = String(process.argv[2] || '').trim();
  if (!toEmail) {
    throw new Error('Usage: sendTestEmails.ts <toEmail>');
  }

  const extraArgs = process.argv.slice(3);
  const takeFlagValue = (flag: string): string | null => {
    const prefix = `${flag}=`;
    for (let i = 0; i < extraArgs.length; i += 1) {
      const arg = String(extraArgs[i] ?? '').trim();
      if (!arg) continue;
      if (arg.startsWith(prefix)) return arg.slice(prefix.length).trim();
      if (arg === flag) return String(extraArgs[i + 1] ?? '').trim();
    }
    return null;
  };

  const onlyRaw = takeFlagValue('--only');
  const listOnly = extraArgs.some((arg) => String(arg || '').trim() === '--list');
  const onlyKeys = onlyRaw
    ? onlyRaw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : null;

  const base = resolveClientUrl();
  // Use a non-existing user id so unsubscribe links validate but don't affect real users.
  const testUserId = 999_999_999;
  const unsubscribeUrl = buildMarketingUnsubscribeUrl(testUserId) ?? undefined;

  const plansUrl = appendQueryParams(`${base}/planes`, {
    utm_source: 'email',
    utm_medium: 'test',
    utm_campaign: 'template_preview',
    utm_content: 'plans',
  });
  const accountUrl = appendQueryParams(`${base}/micuenta`, {
    utm_source: 'email',
    utm_medium: 'test',
    utm_campaign: 'template_preview',
    utm_content: 'account',
  });
  const catalogUrl = appendQueryParams(`${base}/descargas`, {
    utm_source: 'email',
    utm_medium: 'test',
    utm_campaign: 'template_preview',
    utm_content: 'catalog',
  });

  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const expiresAtText = `${expiresAt.toISOString().replace('T', ' ').slice(0, 16)} UTC`;

  const samples: Array<{ key: string; subject: string; html: string; text: string }> = [
    {
      key: 'welcome',
      ...emailTemplates.welcome({
        name: 'Gustavo',
        email: toEmail,
        plansUrl,
        accountUrl,
        unsubscribeUrl,
      }),
    },
    {
      key: 'passwordReset',
      ...emailTemplates.passwordReset({
        name: 'Gustavo',
        email: toEmail,
        link: `${base}/auth/reset-password?token=TEST_TOKEN&userId=${testUserId}`,
        unsubscribeUrl,
      }),
    },
    {
      key: 'planActivated',
      ...emailTemplates.planActivated({
        name: 'Gustavo',
        planName: 'Plan Oro',
        price: '299',
        currency: 'MXN',
        orderId: 'TEST-ORDER-123',
        catalogUrl,
        accountUrl,
        unsubscribeUrl,
      }),
    },
    {
      key: 'automationTrialNoDownload24h',
      ...emailTemplates.automationTrialNoDownload24h({
        name: 'Gustavo',
        url: appendQueryParams(`${base}/`, {
          utm_source: 'email',
          utm_medium: 'test',
          utm_campaign: 'trial_no_download_24h',
          utm_content: 'cta',
        }),
        unsubscribeUrl,
      }),
    },
    {
      key: 'automationPaidNoDownload24h',
      ...emailTemplates.automationPaidNoDownload24h({
        name: 'Gustavo',
        url: appendQueryParams(`${base}/`, {
          utm_source: 'email',
          utm_medium: 'test',
          utm_campaign: 'paid_no_download_24h',
          utm_content: 'cta',
        }),
        unsubscribeUrl,
      }),
    },
    {
      key: 'automationRegisteredNoPurchase7d',
      ...emailTemplates.automationRegisteredNoPurchase7d({
        name: 'Gustavo',
        url: appendQueryParams(`${base}/planes`, {
          utm_source: 'email',
          utm_medium: 'test',
          utm_campaign: 'registered_no_purchase_7d',
          utm_content: 'cta',
        }),
        unsubscribeUrl,
      }),
    },
    {
      key: 'automationPlansOffer',
      ...emailTemplates.automationPlansOffer({
        name: 'Gustavo',
        url: appendQueryParams(`${base}/planes`, {
          utm_source: 'email',
          utm_medium: 'test',
          utm_campaign: 'plans_offer_30',
          utm_content: 'cta',
        }),
        couponCode: 'BB30U999999999',
        percentOff: 30,
        expiresAt: expiresAtText,
        unsubscribeUrl,
      }),
    },
    {
      key: 'winbackLapsedOffer',
      ...emailTemplates.winbackLapsedOffer({
        name: 'Gustavo',
        url: appendQueryParams(`${base}/planes`, {
          utm_source: 'email',
          utm_medium: 'test',
          utm_campaign: 'winback_lapsed_50',
          utm_content: 'cta',
        }),
        couponCode: 'BB50W999999999',
        percentOff: 50,
        expiresAt: expiresAtText,
        unsubscribeUrl,
      }),
    },
    {
      key: 'registeredNoPurchaseOffer',
      ...emailTemplates.registeredNoPurchaseOffer({
        name: 'Gustavo',
        url: appendQueryParams(`${base}/planes`, {
          utm_source: 'email',
          utm_medium: 'test',
          utm_campaign: 'registered_no_purchase_offer_30',
          utm_content: 'cta',
        }),
        couponCode: 'BB30R999999999',
        percentOff: 30,
        expiresAt: expiresAtText,
        unsubscribeUrl,
      }),
    },
    {
      key: 'automationVerifyWhatsApp24h',
      ...emailTemplates.automationVerifyWhatsApp24h({
        name: 'Gustavo',
        url: accountUrl,
      }),
    },
    {
      key: 'automationCheckoutAbandoned',
      ...emailTemplates.automationCheckoutAbandoned({
        name: 'Gustavo',
        url: appendQueryParams(`${base}/comprar?priceId=1`, {
          utm_source: 'email',
          utm_medium: 'test',
          utm_campaign: 'checkout_abandoned_24h',
          utm_content: 'cta',
        }),
        planName: 'Plan Oro',
        price: '299',
        currency: 'MXN',
        unsubscribeUrl,
      }),
    },
    {
      key: 'automationTrialExpiring24h',
      ...emailTemplates.automationTrialExpiring24h({
        name: 'Gustavo',
        url: plansUrl,
        unsubscribeUrl,
      }),
    },
    {
      key: 'automationActiveNoDownload',
      ...emailTemplates.automationActiveNoDownload({
        name: 'Gustavo',
        url: catalogUrl,
        days: 7,
        unsubscribeUrl,
      }),
    },
    {
      key: 'analyticsAlerts',
      ...emailTemplates.analyticsAlerts({
        days: 7,
        count: 2,
        detailsText: 'Example alert 1\\nExample alert 2',
        generatedAt: new Date().toISOString(),
      }),
    },
  ];

  const availableKeys = samples.map((sample) => sample.key);
  if (listOnly) {
    // eslint-disable-next-line no-console
    console.log(availableKeys.join('\n'));
    return;
  }

  const selectedSamples =
    onlyKeys && onlyKeys.length > 0
      ? samples.filter((sample) => onlyKeys.includes(sample.key))
      : samples;

  if (onlyKeys && selectedSamples.length === 0) {
    throw new Error(`No templates matched --only=${onlyRaw}. Available keys: ${availableKeys.join(', ')}`);
  }

  for (const tpl of selectedSamples) {
    await sendEmail({
      to: [toEmail],
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    // eslint-disable-next-line no-console
    console.log(`[TEST_EMAIL] Sent (${tpl.key}): ${tpl.subject}`);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[TEST_EMAIL] Failed', error);
  process.exitCode = 1;
});
