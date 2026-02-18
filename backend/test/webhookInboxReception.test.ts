import type { Request } from 'express';
import { receiveWebhookIntoInbox } from '../src/endpoints/webhooks/webhookInboxReception';
import * as webhookInboxQueueModule from '../src/queue/webhookInbox';
import * as webhookInboxServiceModule from '../src/webhookInbox/service';

jest.mock('../src/queue/webhookInbox', () => ({
  enqueueWebhookInboxJob: jest.fn(),
}));

jest.mock('../src/webhookInbox/service', () => ({
  persistWebhookInboxEvent: jest.fn(),
  markWebhookInboxEventEnqueued: jest.fn(),
}));

const buildReq = ({
  body,
  headers,
}: {
  body: Buffer | string | Record<string, unknown>;
  headers?: Record<string, string>;
}): Request =>
  ({
    body,
    headers: headers || {},
  } as unknown as Request);

describe('receiveWebhookIntoInbox', () => {
  const persistMock = webhookInboxServiceModule.persistWebhookInboxEvent as jest.Mock;
  const markEnqueuedMock = webhookInboxServiceModule.markWebhookInboxEventEnqueued as jest.Mock;
  const enqueueMock = webhookInboxQueueModule.enqueueWebhookInboxJob as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when payload JSON is invalid', async () => {
    const req = buildReq({ body: Buffer.from('not-json', 'utf8') });

    const result = await receiveWebhookIntoInbox({
      provider: 'conekta',
      req,
      logPrefix: 'CONEKTA_WH',
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      message: 'Invalid JSON payload',
    });
    expect(persistMock).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('returns 400 when payload does not include event id/type', async () => {
    const req = buildReq({ body: Buffer.from('{"foo":"bar"}', 'utf8') });

    const result = await receiveWebhookIntoInbox({
      provider: 'stripe',
      req,
      logPrefix: 'STRIPE_WH',
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      message: 'Invalid webhook payload',
    });
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('returns ok duplicate when event was already persisted', async () => {
    const req = buildReq({
      body: Buffer.from('{"id":"evt_1","type":"customer.subscription.updated"}', 'utf8'),
    });
    persistMock.mockResolvedValue({ kind: 'duplicate' });

    const result = await receiveWebhookIntoInbox({
      provider: 'stripe',
      req,
      logPrefix: 'STRIPE_WH',
    });

    expect(result).toEqual({ ok: true, duplicate: true });
    expect(enqueueMock).not.toHaveBeenCalled();
    expect(markEnqueuedMock).not.toHaveBeenCalled();
  });

  it('enqueues and marks event when persistence succeeds', async () => {
    const req = buildReq({
      body: Buffer.from('{"id":"evt_2","type":"customer.subscription.updated"}', 'utf8'),
    });
    persistMock.mockResolvedValue({ kind: 'created', inboxId: 123 });
    enqueueMock.mockResolvedValue(true);

    const result = await receiveWebhookIntoInbox({
      provider: 'stripe',
      req,
      logPrefix: 'STRIPE_WH',
    });

    expect(result).toEqual({ ok: true, duplicate: false });
    expect(enqueueMock).toHaveBeenCalledWith({ inboxId: 123 });
    expect(markEnqueuedMock).toHaveBeenCalledWith(123);
  });

  it('keeps 2xx semantics when enqueue fails after persist', async () => {
    const req = buildReq({
      body: Buffer.from('{"id":"evt_3","type":"customer.subscription.updated"}', 'utf8'),
    });
    persistMock.mockResolvedValue({ kind: 'created', inboxId: 456 });
    enqueueMock.mockResolvedValue(false);

    const result = await receiveWebhookIntoInbox({
      provider: 'stripe',
      req,
      logPrefix: 'STRIPE_WH',
    });

    expect(result).toEqual({ ok: true, duplicate: false });
    expect(markEnqueuedMock).not.toHaveBeenCalled();
  });

  it('returns 500 when persistence fails', async () => {
    const req = buildReq({
      body: Buffer.from('{"id":"evt_4","type":"customer.subscription.updated"}', 'utf8'),
    });
    persistMock.mockRejectedValue(new Error('db_write_failed'));

    const result = await receiveWebhookIntoInbox({
      provider: 'stripe',
      req,
      logPrefix: 'STRIPE_WH',
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      message: 'Failed to persist webhook event',
    });
  });
});

