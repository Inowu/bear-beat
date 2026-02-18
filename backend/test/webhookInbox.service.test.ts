const createMock = jest.fn();
const findFirstMock = jest.fn();

jest.mock('../src/db', () => ({
  prisma: {
    $transaction: async (callback: any) =>
      callback({
        webhookInboxEvent: {
          create: createMock,
          findFirst: findFirstMock,
        },
      }),
  },
}));

import {
  computeBackoff,
  persistEvent,
} from '../src/services/webhookInbox';

const ORIGINAL_ENV = {
  WEBHOOK_INBOX_RETRY_BASE_MS: process.env.WEBHOOK_INBOX_RETRY_BASE_MS,
  WEBHOOK_INBOX_RETRY_CAP_MS: process.env.WEBHOOK_INBOX_RETRY_CAP_MS,
};

const restoreEnv = () => {
  if (ORIGINAL_ENV.WEBHOOK_INBOX_RETRY_BASE_MS === undefined) {
    delete process.env.WEBHOOK_INBOX_RETRY_BASE_MS;
  } else {
    process.env.WEBHOOK_INBOX_RETRY_BASE_MS = ORIGINAL_ENV.WEBHOOK_INBOX_RETRY_BASE_MS;
  }

  if (ORIGINAL_ENV.WEBHOOK_INBOX_RETRY_CAP_MS === undefined) {
    delete process.env.WEBHOOK_INBOX_RETRY_CAP_MS;
  } else {
    process.env.WEBHOOK_INBOX_RETRY_CAP_MS = ORIGINAL_ENV.WEBHOOK_INBOX_RETRY_CAP_MS;
  }
};

describe('persistEvent', () => {
  afterEach(() => {
    createMock.mockReset();
    findFirstMock.mockReset();
  });

  it.each([
    ['stripe', 'evt_stripe_123', 'customer.subscription.updated'],
    ['paypal', 'WH-PAYPAL-123', 'BILLING.SUBSCRIPTION.ACTIVATED'],
    ['conekta', 'evt_conekta_123', 'order.paid'],
  ])(
    'deduplicates provider=%s by provider + eventId and returns existing inboxId',
    async (provider, eventId, eventType) => {
      createMock
        .mockResolvedValueOnce({ id: 101 })
        .mockRejectedValueOnce({
          code: 'P2002',
          meta: { target: ['provider', 'event_id'] },
        });

      findFirstMock.mockResolvedValueOnce({ id: 101 });

      const first = await persistEvent({
        provider,
        eventId,
        eventType,
        livemode: false,
        headers: { sample: 'header' },
        payloadRaw: `{"id":"${eventId}"}`,
      });

      const second = await persistEvent({
        provider,
        eventId,
        eventType,
        livemode: false,
        headers: { sample: 'header' },
        payloadRaw: `{"id":"${eventId}"}`,
      });

      expect(first).toEqual({ created: true, inboxId: 101 });
      expect(second).toEqual({ created: false, inboxId: 101 });
      expect(createMock).toHaveBeenCalledTimes(2);
      expect(findFirstMock).toHaveBeenCalledTimes(1);
    },
  );
});

describe('computeBackoff', () => {
  beforeEach(() => {
    process.env.WEBHOOK_INBOX_RETRY_BASE_MS = '1000';
    process.env.WEBHOOK_INBOX_RETRY_CAP_MS = '10000';
  });

  afterEach(() => {
    restoreEnv();
  });

  it('grows exponentially and caps at configured max', () => {
    expect(computeBackoff(1)).toBe(1000);
    expect(computeBackoff(2)).toBe(2000);
    expect(computeBackoff(3)).toBe(4000);
    expect(computeBackoff(4)).toBe(8000);
    expect(computeBackoff(5)).toBe(10000);
    expect(computeBackoff(8)).toBe(10000);
  });
});
