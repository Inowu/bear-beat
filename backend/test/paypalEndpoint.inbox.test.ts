import type { Request, Response } from 'express';

jest.mock('../src/routers/utils/verifyPaypalSignature', () => ({
  verifyPaypalSignature: jest.fn(),
}));

jest.mock('../src/services/webhookInbox', () => ({
  persistEvent: jest.fn(),
}));

jest.mock('../src/queues/webhookInbox.queue', () => ({
  enqueueWebhookInboxJob: jest.fn(),
}));

jest.mock('../src/webhookInbox/service', () => ({
  markWebhookInboxEventEnqueued: jest.fn(),
}));

import { paypalEndpoint } from '../src/endpoints/webhooks/paypal.endpoint';
import { verifyPaypalSignature } from '../src/routers/utils/verifyPaypalSignature';
import { persistEvent } from '../src/services/webhookInbox';
import { enqueueWebhookInboxJob } from '../src/queues/webhookInbox.queue';
import { markWebhookInboxEventEnqueued } from '../src/webhookInbox/service';

const verifyPaypalSignatureMock = verifyPaypalSignature as jest.Mock;
const persistEventMock = persistEvent as jest.Mock;
const enqueueWebhookInboxJobMock = enqueueWebhookInboxJob as jest.Mock;
const markWebhookInboxEventEnqueuedMock = markWebhookInboxEventEnqueued as jest.Mock;

const buildReq = (body: unknown): Request =>
  ({
    body,
    headers: {
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api.paypal.com/certs/1',
      'paypal-transmission-id': 'abc',
      'paypal-transmission-sig': 'sig',
      'paypal-transmission-time': new Date().toISOString(),
    },
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

describe('paypalEndpoint (inbox)', () => {
  beforeEach(() => {
    verifyPaypalSignatureMock.mockReset();
    persistEventMock.mockReset();
    enqueueWebhookInboxJobMock.mockReset();
    markWebhookInboxEventEnqueuedMock.mockReset();
  });

  it('returns 400 and does not persist when signature is invalid', async () => {
    const req = buildReq(
      Buffer.from('{"id":"WH-1","event_type":"BILLING.SUBSCRIPTION.ACTIVATED"}', 'utf8'),
    );
    const res = buildRes();

    verifyPaypalSignatureMock.mockResolvedValue(false);

    await paypalEndpoint(req, res);

    expect(persistEventMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid signature');
  });

  it('returns 200 immediately when event is duplicate', async () => {
    const payload = Buffer.from(
      '{"id":"WH-1","event_type":"BILLING.SUBSCRIPTION.ACTIVATED"}',
      'utf8',
    );
    const req = buildReq(payload);
    const res = buildRes();

    verifyPaypalSignatureMock.mockResolvedValue(true);
    persistEventMock.mockResolvedValue({
      created: false,
      inboxId: 91,
    });

    await paypalEndpoint(req, res);

    expect(persistEventMock).toHaveBeenCalledWith({
      provider: 'paypal',
      eventId: 'WH-1',
      eventType: 'BILLING.SUBSCRIPTION.ACTIVATED',
      livemode: null,
      headers: req.headers,
      payloadRaw: payload.toString('utf8'),
    });
    expect(enqueueWebhookInboxJobMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('returns 200 when event is persisted and enqueued', async () => {
    const payload = Buffer.from(
      '{"id":"WH-2","event_type":"BILLING.SUBSCRIPTION.UPDATED"}',
      'utf8',
    );
    const req = buildReq(payload);
    const res = buildRes();

    verifyPaypalSignatureMock.mockResolvedValue(true);
    persistEventMock.mockResolvedValue({
      created: true,
      inboxId: 92,
    });
    enqueueWebhookInboxJobMock.mockResolvedValue(true);
    markWebhookInboxEventEnqueuedMock.mockResolvedValue(undefined);

    await paypalEndpoint(req, res);

    expect(enqueueWebhookInboxJobMock).toHaveBeenCalledWith({ inboxId: 92 });
    expect(markWebhookInboxEventEnqueuedMock).toHaveBeenCalledWith(92);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('returns 400 when payload is invalid json after signature verification', async () => {
    const req = buildReq(Buffer.from('not-json', 'utf8'));
    const res = buildRes();

    verifyPaypalSignatureMock.mockResolvedValue(true);

    await paypalEndpoint(req, res);

    expect(persistEventMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid JSON payload');
  });
});
