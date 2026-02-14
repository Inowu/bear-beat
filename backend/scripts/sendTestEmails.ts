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

  const samples = [
    emailTemplates.welcome({
      name: 'Gustavo',
      email: toEmail,
      plansUrl,
      accountUrl,
      unsubscribeUrl,
    }),
    emailTemplates.passwordReset({
      name: 'Gustavo',
      email: toEmail,
      link: `${base}/auth/reset-password?token=TEST_TOKEN&userId=${testUserId}`,
      unsubscribeUrl,
    }),
    emailTemplates.planActivated({
      name: 'Gustavo',
      planName: 'Plan Oro',
      price: '299',
      currency: 'MXN',
      orderId: 'TEST-ORDER-123',
      catalogUrl,
      accountUrl,
      unsubscribeUrl,
    }),
    emailTemplates.automationTrialNoDownload24h({
      name: 'Gustavo',
      url: appendQueryParams(`${base}/`, {
        utm_source: 'email',
        utm_medium: 'test',
        utm_campaign: 'trial_no_download_24h',
        utm_content: 'cta',
      }),
      unsubscribeUrl,
    }),
    emailTemplates.automationPaidNoDownload24h({
      name: 'Gustavo',
      url: appendQueryParams(`${base}/`, {
        utm_source: 'email',
        utm_medium: 'test',
        utm_campaign: 'paid_no_download_24h',
        utm_content: 'cta',
      }),
      unsubscribeUrl,
    }),
    emailTemplates.automationRegisteredNoPurchase7d({
      name: 'Gustavo',
      url: appendQueryParams(`${base}/planes`, {
        utm_source: 'email',
        utm_medium: 'test',
        utm_campaign: 'registered_no_purchase_7d',
        utm_content: 'cta',
      }),
      unsubscribeUrl,
    }),
    emailTemplates.automationPlansOffer({
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
    emailTemplates.automationVerifyWhatsApp24h({
      name: 'Gustavo',
      url: accountUrl,
    }),
    emailTemplates.automationCheckoutAbandoned({
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
    emailTemplates.automationTrialExpiring24h({
      name: 'Gustavo',
      url: plansUrl,
      unsubscribeUrl,
    }),
    emailTemplates.automationActiveNoDownload({
      name: 'Gustavo',
      url: catalogUrl,
      days: 7,
      unsubscribeUrl,
    }),
    emailTemplates.analyticsAlerts({
      days: 7,
      count: 2,
      detailsText: 'Example alert 1\\nExample alert 2',
      generatedAt: new Date().toISOString(),
    }),
  ];

  for (const tpl of samples) {
    await sendEmail({
      to: [toEmail],
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    // eslint-disable-next-line no-console
    console.log(`[TEST_EMAIL] Sent: ${tpl.subject}`);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[TEST_EMAIL] Failed', error);
  process.exitCode = 1;
});

