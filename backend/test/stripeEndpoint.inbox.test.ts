import type { Request, Response } from 'express';

jest.mock('../src/services/webhookInbox', () => ({
  persistEvent: jest.fn(),
}));

jest.mock('../src/queues/webhookInbox.queue', () => ({
  enqueueWebhookInboxJob: jest.fn(),
}));

jest.mock('../src/webhookInbox/service', () => ({
  markWebhookInboxEventEnqueued: jest.fn(),
}));

jest.mock('../src/stripe', () => ({
  __esModule: true,
  default: {
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
}));

import stripeInstance from '../src/stripe';
import { stripeEndpoint } from '../src/endpoints/webhooks/stripe.endpoint';
import { persistEvent } from '../src/services/webhookInbox';
import { enqueueWebhookInboxJob } from '../src/queues/webhookInbox.queue';
import { markWebhookInboxEventEnqueued } from '../src/webhookInbox/service';

const constructEventMock = (stripeInstance as any).webhooks
  .constructEvent as jest.Mock;
const persistEventMock = persistEvent as jest.Mock;
const enqueueWebhookInboxJobMock = enqueueWebhookInboxJob as jest.Mock;
const markWebhookInboxEventEnqueuedMock = markWebhookInboxEventEnqueued as jest.Mock;

const ORIGINAL_ENV = {
  STRIPE_WH_SECRET: process.env.STRIPE_WH_SECRET,
};

const restoreEnv = () => {
  if (ORIGINAL_ENV.STRIPE_WH_SECRET === undefined) {
    delete process.env.STRIPE_WH_SECRET;
  } else {
    process.env.STRIPE_WH_SECRET = ORIGINAL_ENV.STRIPE_WH_SECRET;
  }
};

const buildReq = ({
  body,
  signature,
}: {
  body: Buffer;
  signature?: string;
}): Request =>
  ({
    body,
    headers: signature ? { 'stripe-signature': signature } : {},
  } as unknown as Request);

const buildRes = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  };

  return res as unknown as Response & {
    status: jest.Mock;
    send: jest.Mock;
    end: jest.Mock;
  };
};

describe('stripeEndpoint (inbox)', () => {
  beforeEach(() => {
    process.env.STRIPE_WH_SECRET = 'whsec_test_123';
    constructEventMock.mockReset();
    persistEventMock.mockReset();
    enqueueWebhookInboxJobMock.mockReset();
    markWebhookInboxEventEnqueuedMock.mockReset();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('returns 400 when signature verification fails', async () => {
    const req = buildReq({
      body: Buffer.from('{"id":"evt_1"}', 'utf8'),
      signature: 't=1,v1=bad',
    });
    const res = buildRes();

    constructEventMock.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    await stripeEndpoint(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid signature');
    expect(persistEventMock).not.toHaveBeenCalled();
  });

  it('returns 200 immediately for duplicated event', async () => {
    const req = buildReq({
      body: Buffer.from('{"id":"evt_dup","type":"customer.subscription.updated"}', 'utf8'),
      signature: 't=1,v1=ok',
    });
    const res = buildRes();

    constructEventMock.mockReturnValue({
      id: 'evt_dup',
      type: 'customer.subscription.updated',
      livemode: false,
    });
    persistEventMock.mockResolvedValue({
      created: false,
      inboxId: 77,
    });

    await stripeEndpoint(req, res);

    expect(enqueueWebhookInboxJobMock).not.toHaveBeenCalled();
    expect(markWebhookInboxEventEnqueuedMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('persists and enqueues event, then responds 200', async () => {
    const req = buildReq({
      body: Buffer.from('{"id":"evt_ok","type":"customer.subscription.updated"}', 'utf8'),
      signature: 't=1,v1=ok',
    });
    const res = buildRes();

    constructEventMock.mockReturnValue({
      id: 'evt_ok',
      type: 'customer.subscription.updated',
      livemode: true,
    });
    persistEventMock.mockResolvedValue({
      created: true,
      inboxId: 88,
    });
    enqueueWebhookInboxJobMock.mockResolvedValue(true);
    markWebhookInboxEventEnqueuedMock.mockResolvedValue(undefined);

    await stripeEndpoint(req, res);

    expect(persistEventMock).toHaveBeenCalledTimes(1);
    expect(enqueueWebhookInboxJobMock).toHaveBeenCalledWith({ inboxId: 88 });
    expect(markWebhookInboxEventEnqueuedMock).toHaveBeenCalledWith(88);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('returns 500 when persistence/enqueue fails', async () => {
    const req = buildReq({
      body: Buffer.from('{"id":"evt_fail","type":"customer.subscription.updated"}', 'utf8'),
      signature: 't=1,v1=ok',
    });
    const res = buildRes();

    constructEventMock.mockReturnValue({
      id: 'evt_fail',
      type: 'customer.subscription.updated',
      livemode: false,
    });
    persistEventMock.mockRejectedValue(new Error('db_down'));

    await stripeEndpoint(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Failed to persist webhook event');
  });
});
