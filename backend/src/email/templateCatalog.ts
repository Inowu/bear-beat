import { emailTemplates } from './templates';

export type EmailTemplateKey = keyof typeof emailTemplates;

export type EmailTemplateCategory = 'transactional' | 'automation' | 'ops';

export interface EmailTemplateContent {
  subject: string;
  html: string;
  text: string;
}

export interface EmailTemplateCatalogEntry {
  key: EmailTemplateKey;
  label: string;
  description: string;
  category: EmailTemplateCategory;
  tokens: string[];
  sampleVariables: Record<string, string>;
}

const SAMPLE_BASE_URL = 'https://thebearbeat.com';
const SAMPLE_UNSUBSCRIBE_URL = `${SAMPLE_BASE_URL}/api/comms/unsubscribe?t=sample`;

const EMAIL_TEMPLATE_CATALOG: ReadonlyArray<EmailTemplateCatalogEntry> = [
  {
    key: 'welcome',
    label: 'Welcome',
    description: 'Welcome email after sign up.',
    category: 'transactional',
    tokens: ['NAME', 'EMAIL', 'PLANS_URL', 'ACCOUNT_URL', 'UNSUBSCRIBE_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      EMAIL: 'gustavo@example.com',
      PLANS_URL: `${SAMPLE_BASE_URL}/planes`,
      ACCOUNT_URL: `${SAMPLE_BASE_URL}/micuenta`,
      UNSUBSCRIBE_URL: SAMPLE_UNSUBSCRIBE_URL,
    },
  },
  {
    key: 'passwordReset',
    label: 'Password reset',
    description: 'Password reset link email.',
    category: 'transactional',
    tokens: ['NAME', 'EMAIL', 'LINK', 'UNSUBSCRIBE_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      EMAIL: 'gustavo@example.com',
      LINK: `${SAMPLE_BASE_URL}/auth/reset-password?token=TEST_TOKEN&userId=999`,
      UNSUBSCRIBE_URL: SAMPLE_UNSUBSCRIBE_URL,
    },
  },
  {
    key: 'planActivated',
    label: 'Plan activated',
    description: 'Plan purchase confirmation.',
    category: 'transactional',
    tokens: [
      'NAME',
      'PLAN_NAME',
      'PRICE',
      'CURRENCY',
      'ORDER_ID',
      'CATALOG_URL',
      'ACCOUNT_URL',
      'UNSUBSCRIBE_URL',
    ],
    sampleVariables: {
      NAME: 'Gustavo',
      PLAN_NAME: 'Plan Oro',
      PRICE: '299',
      CURRENCY: 'MXN',
      ORDER_ID: 'ORDER-12345',
      CATALOG_URL: `${SAMPLE_BASE_URL}/descargas`,
      ACCOUNT_URL: `${SAMPLE_BASE_URL}/micuenta`,
      UNSUBSCRIBE_URL: SAMPLE_UNSUBSCRIBE_URL,
    },
  },
  {
    key: 'cancellationConfirmed',
    label: 'Cancellation confirmed',
    description: 'Confirmation when subscription cancellation is requested.',
    category: 'transactional',
    tokens: ['NAME', 'PLAN_NAME', 'ACCESS_UNTIL', 'ACCOUNT_URL', 'REACTIVATE_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      PLAN_NAME: 'Plan Oro',
      ACCESS_UNTIL: '2026-03-01',
      ACCOUNT_URL: `${SAMPLE_BASE_URL}/micuenta`,
      REACTIVATE_URL: `${SAMPLE_BASE_URL}/planes`,
    },
  },
  {
    key: 'cancellationEndingSoon',
    label: 'Cancellation ending soon',
    description: 'Reminder 3 days before access ends.',
    category: 'transactional',
    tokens: ['NAME', 'ACCESS_UNTIL', 'ACCOUNT_URL', 'REACTIVATE_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      ACCESS_UNTIL: '2026-03-01',
      ACCOUNT_URL: `${SAMPLE_BASE_URL}/micuenta`,
      REACTIVATE_URL: `${SAMPLE_BASE_URL}/planes`,
    },
  },
  {
    key: 'automationTrialNoDownload24h',
    label: 'Trial no download (24h)',
    description: 'Automation: trial user with no downloads in 24h.',
    category: 'automation',
    tokens: ['NAME', 'URL', 'UNSUBSCRIBE_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      URL: `${SAMPLE_BASE_URL}/`,
      UNSUBSCRIBE_URL: SAMPLE_UNSUBSCRIBE_URL,
    },
  },
  {
    key: 'automationPaidNoDownload24h',
    label: 'Paid no download (24h)',
    description: 'Automation: first paid user with no downloads in 24h.',
    category: 'automation',
    tokens: ['NAME', 'URL', 'UNSUBSCRIBE_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      URL: `${SAMPLE_BASE_URL}/`,
      UNSUBSCRIBE_URL: SAMPLE_UNSUBSCRIBE_URL,
    },
  },
  {
    key: 'automationPaidNoDownload2h',
    label: 'Paid no download (2h)',
    description: 'Automation: first paid user with no downloads in first 2h.',
    category: 'automation',
    tokens: ['NAME', 'INSTRUCTIONS_URL', 'CATALOG_URL', 'RECOMMENDED_FOLDER', 'UNSUBSCRIBE_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      INSTRUCTIONS_URL: `${SAMPLE_BASE_URL}/instrucciones`,
      CATALOG_URL: `${SAMPLE_BASE_URL}/`,
      RECOMMENDED_FOLDER: 'Semana',
      UNSUBSCRIBE_URL: SAMPLE_UNSUBSCRIBE_URL,
    },
  },
  {
    key: 'automationRegisteredNoPurchase7d',
    label: 'Registered no purchase (7d)',
    description: 'Legacy automation template for registered users without purchase.',
    category: 'automation',
    tokens: ['NAME', 'URL', 'UNSUBSCRIBE_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      URL: `${SAMPLE_BASE_URL}/planes`,
      UNSUBSCRIBE_URL: SAMPLE_UNSUBSCRIBE_URL,
    },
  },
  {
    key: 'automationPlansOffer',
    label: 'Plans offer',
    description: 'Automation offer after plans view.',
    category: 'automation',
    tokens: ['NAME', 'URL', 'COUPON_CODE', 'PERCENT_OFF', 'EXPIRES_AT', 'UNSUBSCRIBE_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      URL: `${SAMPLE_BASE_URL}/planes`,
      COUPON_CODE: 'BB30TESTCODE',
      PERCENT_OFF: '30',
      EXPIRES_AT: '2026-03-01 23:59 UTC',
      UNSUBSCRIBE_URL: SAMPLE_UNSUBSCRIBE_URL,
    },
  },
  {
    key: 'winbackLapsedOffer',
    label: 'Winback lapsed offer',
    description: 'Automation offer for lapsed members.',
    category: 'automation',
    tokens: ['NAME', 'URL', 'COUPON_CODE', 'PERCENT_OFF', 'EXPIRES_AT', 'UNSUBSCRIBE_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      URL: `${SAMPLE_BASE_URL}/planes`,
      COUPON_CODE: 'BB50WINBACK',
      PERCENT_OFF: '50',
      EXPIRES_AT: '2026-03-01 23:59 UTC',
      UNSUBSCRIBE_URL: SAMPLE_UNSUBSCRIBE_URL,
    },
  },
  {
    key: 'registeredNoPurchaseOffer',
    label: 'Registered no purchase offer',
    description: 'Automation offer for registered users with no purchase.',
    category: 'automation',
    tokens: ['NAME', 'URL', 'COUPON_CODE', 'PERCENT_OFF', 'EXPIRES_AT', 'UNSUBSCRIBE_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      URL: `${SAMPLE_BASE_URL}/planes`,
      COUPON_CODE: 'BB30REGISTER',
      PERCENT_OFF: '30',
      EXPIRES_AT: '2026-03-01 23:59 UTC',
      UNSUBSCRIBE_URL: SAMPLE_UNSUBSCRIBE_URL,
    },
  },
  {
    key: 'automationVerifyWhatsApp24h',
    label: 'Verify WhatsApp (24h)',
    description: 'Automation reminder to verify WhatsApp.',
    category: 'automation',
    tokens: ['NAME', 'URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      URL: `${SAMPLE_BASE_URL}/micuenta`,
    },
  },
  {
    key: 'automationCheckoutAbandoned',
    label: 'Checkout abandoned',
    description: 'Automation email for abandoned checkout.',
    category: 'automation',
    tokens: ['NAME', 'URL', 'PLAN_NAME', 'PRICE', 'CURRENCY', 'UNSUBSCRIBE_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      URL: `${SAMPLE_BASE_URL}/comprar?priceId=1`,
      PLAN_NAME: 'Plan Oro',
      PRICE: '299',
      CURRENCY: 'MXN',
      UNSUBSCRIBE_URL: SAMPLE_UNSUBSCRIBE_URL,
    },
  },
  {
    key: 'automationTrialExpiring24h',
    label: 'Trial expiring (24h)',
    description: 'Automation email 24h before trial expiration.',
    category: 'automation',
    tokens: ['NAME', 'URL', 'UNSUBSCRIBE_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      URL: `${SAMPLE_BASE_URL}/planes`,
      UNSUBSCRIBE_URL: SAMPLE_UNSUBSCRIBE_URL,
    },
  },
  {
    key: 'automationActiveNoDownload',
    label: 'Active no download',
    description: 'Automation email for active users with no recent downloads.',
    category: 'automation',
    tokens: ['NAME', 'URL', 'DAYS', 'UNSUBSCRIBE_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      URL: `${SAMPLE_BASE_URL}/`,
      DAYS: '7',
      UNSUBSCRIBE_URL: SAMPLE_UNSUBSCRIBE_URL,
    },
  },
  {
    key: 'dunningPaymentFailed',
    label: 'Dunning payment failed',
    description: 'Transactional dunning notice for failed renewals.',
    category: 'transactional',
    tokens: ['NAME', 'CTA_URL', 'STAGE_DAYS', 'ACCESS_UNTIL', 'SUPPORT_URL'],
    sampleVariables: {
      NAME: 'Gustavo',
      CTA_URL: `${SAMPLE_BASE_URL}/micuenta`,
      STAGE_DAYS: '1',
      ACCESS_UNTIL: '2026-03-01',
      SUPPORT_URL: `${SAMPLE_BASE_URL}/micuenta`,
    },
  },
  {
    key: 'analyticsAlerts',
    label: 'Analytics alerts',
    description: 'Internal analytics alerts digest.',
    category: 'ops',
    tokens: ['DAYS', 'COUNT', 'DETAILS_TEXT', 'GENERATED_AT'],
    sampleVariables: {
      DAYS: '14',
      COUNT: '2',
      DETAILS_TEXT: 'Example alert A\\nExample alert B',
      GENERATED_AT: '2026-02-19T12:00:00.000Z',
    },
  },
];

const CATALOG_BY_KEY = new Map<EmailTemplateKey, EmailTemplateCatalogEntry>(
  EMAIL_TEMPLATE_CATALOG.map((entry) => [entry.key, entry]),
);

const TEMPLATE_KEY_ALIASES: Record<string, EmailTemplateKey> = {
  automation_trial_no_download_24h: 'automationTrialNoDownload24h',
  automation_paid_no_download_2h: 'automationPaidNoDownload2h',
  automation_paid_no_download_24h: 'automationPaidNoDownload24h',
  automation_registered_no_purchase_7d: 'registeredNoPurchaseOffer',
  automation_verify_whatsapp_24h: 'automationVerifyWhatsApp24h',
  automation_checkout_abandoned_15: 'automationCheckoutAbandoned',
  automation_checkout_abandoned_1: 'automationCheckoutAbandoned',
  automation_checkout_abandoned_24: 'automationCheckoutAbandoned',
  automation_trial_expiring_24h: 'automationTrialExpiring24h',
  automation_active_no_download_7d: 'automationActiveNoDownload',
  automation_active_no_download_14d: 'automationActiveNoDownload',
  automation_active_no_download_21d: 'automationActiveNoDownload',
  automation_cancel_access_end_reminder_3d: 'cancellationEndingSoon',
  automation_winback_lapsed_7d: 'winbackLapsedOffer',
  automation_winback_lapsed_30d: 'winbackLapsedOffer',
  automation_winback_lapsed_60d: 'winbackLapsedOffer',
  automation_plans_offer_stage_1: 'automationPlansOffer',
  automation_plans_offer_stage_2: 'automationPlansOffer',
  automation_plans_offer_stage_3: 'automationPlansOffer',
  automation_dunning_payment_failed_d0: 'dunningPaymentFailed',
  automation_dunning_payment_failed_d1: 'dunningPaymentFailed',
  automation_dunning_payment_failed_d3: 'dunningPaymentFailed',
  automation_dunning_payment_failed_d7: 'dunningPaymentFailed',
  automation_dunning_payment_failed_d14: 'dunningPaymentFailed',
};

const CATALOG_KEYS = EMAIL_TEMPLATE_CATALOG.map((entry) => entry.key);
const CATALOG_KEYS_LOWER = new Map<string, EmailTemplateKey>(
  CATALOG_KEYS.map((key) => [key.toLowerCase(), key]),
);

export const getEmailTemplateCatalog = (): ReadonlyArray<EmailTemplateCatalogEntry> =>
  EMAIL_TEMPLATE_CATALOG;

export const getEmailTemplateCatalogEntry = (
  key: EmailTemplateKey,
): EmailTemplateCatalogEntry => {
  const entry = CATALOG_BY_KEY.get(key);
  if (!entry) {
    throw new Error(`Unknown email template key: ${key}`);
  }
  return entry;
};

export const normalizeEmailTemplateLookupKey = (
  rawTemplateKey: string,
): EmailTemplateKey | null => {
  const key = String(rawTemplateKey || '').trim();
  if (!key) return null;

  const asCatalogKey = CATALOG_KEYS_LOWER.get(key.toLowerCase());
  if (asCatalogKey) return asCatalogKey;

  const alias = TEMPLATE_KEY_ALIASES[key.toLowerCase()];
  if (alias) return alias;

  return null;
};

export const renderDefaultEmailTemplate = (
  templateKey: EmailTemplateKey,
): EmailTemplateContent => {
  const sample = getEmailTemplateCatalogEntry(templateKey).sampleVariables;

  switch (templateKey) {
    case 'welcome':
      return emailTemplates.welcome({
        name: sample.NAME,
        email: sample.EMAIL,
        plansUrl: sample.PLANS_URL,
        accountUrl: sample.ACCOUNT_URL,
        unsubscribeUrl: sample.UNSUBSCRIBE_URL,
      });
    case 'passwordReset':
      return emailTemplates.passwordReset({
        name: sample.NAME,
        email: sample.EMAIL,
        link: sample.LINK,
        unsubscribeUrl: sample.UNSUBSCRIBE_URL,
      });
    case 'planActivated':
      return emailTemplates.planActivated({
        name: sample.NAME,
        planName: sample.PLAN_NAME,
        price: sample.PRICE,
        currency: sample.CURRENCY,
        orderId: sample.ORDER_ID,
        catalogUrl: sample.CATALOG_URL,
        accountUrl: sample.ACCOUNT_URL,
        unsubscribeUrl: sample.UNSUBSCRIBE_URL,
      });
    case 'cancellationConfirmed':
      return emailTemplates.cancellationConfirmed({
        name: sample.NAME,
        planName: sample.PLAN_NAME,
        accessUntil: sample.ACCESS_UNTIL,
        accountUrl: sample.ACCOUNT_URL,
        reactivateUrl: sample.REACTIVATE_URL,
      });
    case 'cancellationEndingSoon':
      return emailTemplates.cancellationEndingSoon({
        name: sample.NAME,
        accessUntil: sample.ACCESS_UNTIL,
        accountUrl: sample.ACCOUNT_URL,
        reactivateUrl: sample.REACTIVATE_URL,
      });
    case 'automationTrialNoDownload24h':
      return emailTemplates.automationTrialNoDownload24h({
        name: sample.NAME,
        url: sample.URL,
        unsubscribeUrl: sample.UNSUBSCRIBE_URL,
      });
    case 'automationPaidNoDownload24h':
      return emailTemplates.automationPaidNoDownload24h({
        name: sample.NAME,
        url: sample.URL,
        unsubscribeUrl: sample.UNSUBSCRIBE_URL,
      });
    case 'automationPaidNoDownload2h':
      return emailTemplates.automationPaidNoDownload2h({
        name: sample.NAME,
        instructionsUrl: sample.INSTRUCTIONS_URL,
        catalogUrl: sample.CATALOG_URL,
        recommendedFolder: sample.RECOMMENDED_FOLDER,
        unsubscribeUrl: sample.UNSUBSCRIBE_URL,
      });
    case 'automationRegisteredNoPurchase7d':
      return emailTemplates.automationRegisteredNoPurchase7d({
        name: sample.NAME,
        url: sample.URL,
        unsubscribeUrl: sample.UNSUBSCRIBE_URL,
      });
    case 'automationPlansOffer':
      return emailTemplates.automationPlansOffer({
        name: sample.NAME,
        url: sample.URL,
        couponCode: sample.COUPON_CODE,
        percentOff: Number(sample.PERCENT_OFF),
        expiresAt: sample.EXPIRES_AT,
        unsubscribeUrl: sample.UNSUBSCRIBE_URL,
      });
    case 'winbackLapsedOffer':
      return emailTemplates.winbackLapsedOffer({
        name: sample.NAME,
        url: sample.URL,
        couponCode: sample.COUPON_CODE,
        percentOff: Number(sample.PERCENT_OFF),
        expiresAt: sample.EXPIRES_AT,
        unsubscribeUrl: sample.UNSUBSCRIBE_URL,
      });
    case 'registeredNoPurchaseOffer':
      return emailTemplates.registeredNoPurchaseOffer({
        name: sample.NAME,
        url: sample.URL,
        couponCode: sample.COUPON_CODE,
        percentOff: Number(sample.PERCENT_OFF),
        expiresAt: sample.EXPIRES_AT,
        unsubscribeUrl: sample.UNSUBSCRIBE_URL,
      });
    case 'automationVerifyWhatsApp24h':
      return emailTemplates.automationVerifyWhatsApp24h({
        name: sample.NAME,
        url: sample.URL,
      });
    case 'automationCheckoutAbandoned':
      return emailTemplates.automationCheckoutAbandoned({
        name: sample.NAME,
        url: sample.URL,
        planName: sample.PLAN_NAME,
        price: sample.PRICE,
        currency: sample.CURRENCY,
        unsubscribeUrl: sample.UNSUBSCRIBE_URL,
      });
    case 'automationTrialExpiring24h':
      return emailTemplates.automationTrialExpiring24h({
        name: sample.NAME,
        url: sample.URL,
        unsubscribeUrl: sample.UNSUBSCRIBE_URL,
      });
    case 'automationActiveNoDownload':
      return emailTemplates.automationActiveNoDownload({
        name: sample.NAME,
        url: sample.URL,
        days: Number(sample.DAYS),
        unsubscribeUrl: sample.UNSUBSCRIBE_URL,
      });
    case 'dunningPaymentFailed':
      return emailTemplates.dunningPaymentFailed({
        name: sample.NAME,
        ctaUrl: sample.CTA_URL,
        stageDays: Number(sample.STAGE_DAYS) as 0 | 1 | 3 | 7 | 14,
        accessUntil: sample.ACCESS_UNTIL,
        supportUrl: sample.SUPPORT_URL,
      });
    case 'analyticsAlerts':
      return emailTemplates.analyticsAlerts({
        days: Number(sample.DAYS),
        count: Number(sample.COUNT),
        detailsText: sample.DETAILS_TEXT,
        generatedAt: sample.GENERATED_AT,
      });
    default:
      return {
        subject: 'Template preview',
        html: '<p>Template preview</p>',
        text: 'Template preview',
      };
  }
};
