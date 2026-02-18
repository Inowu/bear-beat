export const WEBHOOK_INBOX_PROVIDERS = [
  'stripe',
  'stripe_pi',
  'stripe_products',
  'paypal',
  'conekta',
] as const;

export type WebhookInboxProvider = (typeof WEBHOOK_INBOX_PROVIDERS)[number];

export const WEBHOOK_INBOX_STATUSES = [
  'RECEIVED',
  'ENQUEUED',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
  'IGNORED',
] as const;

export type WebhookInboxStatus = (typeof WEBHOOK_INBOX_STATUSES)[number];

export interface WebhookInboxIdentity {
  eventId: string;
  eventType: string;
  livemode: boolean | null;
}

