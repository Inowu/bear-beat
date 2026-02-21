import { createSign, generateKeyPairSync } from 'crypto';
import type { Request, Response } from 'express';
import { conektaEndpoint } from '../src/endpoints/webhooks/conekta.endpoint';
import { conektaWebhookKeys } from '../src/conekta';
import { verifyConektaSignature } from '../src/routers/utils/verifyConektaSignature';

jest.mock('../src/conekta', () => ({
  conektaWebhookKeys: {
    getWebhookKeys: jest.fn(),
  },
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

import { persistEvent } from '../src/services/webhookInbox';
import { enqueueWebhookInboxJob } from '../src/queues/webhookInbox.queue';
import { markWebhookInboxEventEnqueued } from '../src/webhookInbox/service';

const persistEventMock = persistEvent as jest.Mock;
const enqueueWebhookInboxJobMock = enqueueWebhookInboxJob as jest.Mock;
const markWebhookInboxEventEnqueuedMock = markWebhookInboxEventEnqueued as jest.Mock;
const conektaWebhookKeysMock = conektaWebhookKeys as unknown as {
  getWebhookKeys: jest.Mock;
};

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  CONEKTA_WEBHOOK_PUBLIC_KEY: process.env.CONEKTA_WEBHOOK_PUBLIC_KEY,
  CONEKTA_SIGNED_KEY: process.env.CONEKTA_SIGNED_KEY,
  CONEKTA_SIGNED_TEST_KEY: process.env.CONEKTA_SIGNED_TEST_KEY,
};

const restoreConektaSignatureEnv = () => {
  if (ORIGINAL_ENV.NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
  }

  if (ORIGINAL_ENV.CONEKTA_WEBHOOK_PUBLIC_KEY === undefined) {
    delete process.env.CONEKTA_WEBHOOK_PUBLIC_KEY;
  } else {
    process.env.CONEKTA_WEBHOOK_PUBLIC_KEY =
      ORIGINAL_ENV.CONEKTA_WEBHOOK_PUBLIC_KEY;
  }

  if (ORIGINAL_ENV.CONEKTA_SIGNED_KEY === undefined) {
    delete process.env.CONEKTA_SIGNED_KEY;
  } else {
    process.env.CONEKTA_SIGNED_KEY = ORIGINAL_ENV.CONEKTA_SIGNED_KEY;
  }

  if (ORIGINAL_ENV.CONEKTA_SIGNED_TEST_KEY === undefined) {
    delete process.env.CONEKTA_SIGNED_TEST_KEY;
  } else {
    process.env.CONEKTA_SIGNED_TEST_KEY = ORIGINAL_ENV.CONEKTA_SIGNED_TEST_KEY;
  }
};

const toPemString = (key: string | Buffer): string =>
  Buffer.isBuffer(key) ? key.toString('utf8') : key;

const signPayload = (payload: Buffer, privateKeyPem: string): string => {
  const signer = createSign('RSA-SHA256');
  signer.update(payload.toString('utf8'), 'utf8');
  signer.end();
  return signer.sign(privateKeyPem).toString('base64');
};

const buildReq = ({
  body,
  digest,
  headers,
}: {
  body: unknown;
  digest?: string;
  headers?: Record<string, string>;
}): Request =>
  ({
    body,
    headers: {
      ...(headers || {}),
      ...(digest ? { digest } : {}),
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

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

const privateKeyPem = toPemString(
  privateKey.export({ format: 'pem', type: 'pkcs1' }),
);
const publicKeyPem = toPemString(
  publicKey.export({ format: 'pem', type: 'pkcs1' }),
);

describe('verifyConektaSignature', () => {
  afterEach(() => {
    restoreConektaSignatureEnv();
    jest.restoreAllMocks();
  });

  it('returns true when digest matches raw body signature', () => {
    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const digest = signPayload(payload, privateKeyPem);

    expect(verifyConektaSignature(payload, digest, publicKeyPem)).toBe(true);
  });

  it('accepts digest header normalized as sha-256=<base64>', () => {
    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const digest = signPayload(payload, privateKeyPem);

    expect(
      verifyConektaSignature(payload, `sha-256=${digest}`, publicKeyPem),
    ).toBe(true);
  });

  it('accepts digest header with quoted sha-256 value', () => {
    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const digest = signPayload(payload, privateKeyPem);

    expect(
      verifyConektaSignature(payload, `sha-256="${digest}"`, publicKeyPem),
    ).toBe(true);
  });

  it('accepts digest header with multiple algorithms', () => {
    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const digest = signPayload(payload, privateKeyPem);
    const digestHeader = `sha-1=not-used, sha-256=${digest}`;

    expect(
      verifyConektaSignature(payload, digestHeader, publicKeyPem),
    ).toBe(true);
  });

  it('accepts digest header in base64url format', () => {
    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const digestBase64 = signPayload(payload, privateKeyPem);
    const digestBase64Url = digestBase64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    expect(
      verifyConektaSignature(payload, `sha-256=${digestBase64Url}`, publicKeyPem),
    ).toBe(true);
  });

  it('returns false when digest does not match body signature', () => {
    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const digest = signPayload(
      Buffer.from('{"id":"evt_2","type":"order.paid"}', 'utf8'),
      privateKeyPem,
    );

    expect(verifyConektaSignature(payload, digest, publicKeyPem)).toBe(false);
  });

  it('returns false when digest header is missing', () => {
    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    expect(verifyConektaSignature(payload, '', publicKeyPem)).toBe(false);
  });

  it('returns false when signing public key is missing', () => {
    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const digest = signPayload(payload, privateKeyPem);
    expect(verifyConektaSignature(payload, digest, '')).toBe(false);
  });
});

describe('conektaEndpoint', () => {
  beforeEach(() => {
    persistEventMock.mockReset();
    enqueueWebhookInboxJobMock.mockReset();
    markWebhookInboxEventEnqueuedMock.mockReset();
    conektaWebhookKeysMock.getWebhookKeys.mockReset();
    conektaWebhookKeysMock.getWebhookKeys.mockResolvedValue({
      data: {
        data: [],
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    restoreConektaSignatureEnv();
  });

  it('returns 401 and does not process webhook when signature is invalid in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CONEKTA_WEBHOOK_PUBLIC_KEY = publicKeyPem;

    const payload = Buffer.from('{"id":"evt_1"}', 'utf8');
    const invalidDigest = signPayload(Buffer.from('{"id":"evt_2"}', 'utf8'), privateKeyPem);
    const req = buildReq({
      body: payload,
      digest: invalidDigest,
    });
    const res = buildRes();

    await conektaEndpoint(req, res);

    expect(persistEventMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith('Invalid signature');
  });

  it('returns 200 when signature is valid and event is duplicate', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CONEKTA_WEBHOOK_PUBLIC_KEY = publicKeyPem;

    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const digest = signPayload(payload, privateKeyPem);
    const req = buildReq({
      body: payload,
      digest,
    });
    const res = buildRes();

    persistEventMock.mockResolvedValue({
      created: false,
      inboxId: 33,
    });

    await conektaEndpoint(req, res);

    expect(persistEventMock).toHaveBeenCalledWith({
      provider: 'conekta',
      eventId: 'evt_1',
      eventType: 'order.paid',
      livemode: null,
      headers: req.headers,
      payloadRaw: payload.toString('utf8'),
    });
    expect(enqueueWebhookInboxJobMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('returns 200 when signature is valid and event is enqueued', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CONEKTA_WEBHOOK_PUBLIC_KEY = publicKeyPem;

    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const digest = signPayload(payload, privateKeyPem);
    const req = buildReq({
      body: payload,
      digest,
    });
    const res = buildRes();

    persistEventMock.mockResolvedValue({
      created: true,
      inboxId: 34,
    });
    enqueueWebhookInboxJobMock.mockResolvedValue(true);
    markWebhookInboxEventEnqueuedMock.mockResolvedValue(undefined);

    await conektaEndpoint(req, res);

    expect(enqueueWebhookInboxJobMock).toHaveBeenCalledWith({ inboxId: 34 });
    expect(markWebhookInboxEventEnqueuedMock).toHaveBeenCalledWith(34);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('accepts webhook public key with escaped newlines in env var', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CONEKTA_WEBHOOK_PUBLIC_KEY = publicKeyPem.replace(/\n/g, '\\n');

    const payload = Buffer.from('{"id":"evt_esc","type":"order.paid"}', 'utf8');
    const digest = signPayload(payload, privateKeyPem);
    const req = buildReq({
      body: payload,
      digest,
    });
    const res = buildRes();

    persistEventMock.mockResolvedValue({
      created: false,
      inboxId: 35,
    });

    await conektaEndpoint(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('accepts signature in x-conekta-signature header', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CONEKTA_WEBHOOK_PUBLIC_KEY = publicKeyPem;

    const payload = Buffer.from('{"id":"evt_alt","type":"order.paid"}', 'utf8');
    const digest = signPayload(payload, privateKeyPem);
    const req = buildReq({
      body: payload,
      headers: {
        'x-conekta-signature': digest,
      },
    });
    const res = buildRes();

    persistEventMock.mockResolvedValue({
      created: false,
      inboxId: 36,
    });

    await conektaEndpoint(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('returns 500 when persistence fails after successful signature validation', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CONEKTA_WEBHOOK_PUBLIC_KEY = publicKeyPem;

    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const digest = signPayload(payload, privateKeyPem);
    const req = buildReq({
      body: payload,
      digest,
    });
    const res = buildRes();

    persistEventMock.mockRejectedValue(new Error('db_down'));

    await conektaEndpoint(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Failed to persist webhook event');
  });

  it('accepts signature using active webhook key fetched from Conekta API', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CONEKTA_WEBHOOK_PUBLIC_KEY =
      '-----BEGIN PUBLIC KEY-----\\ninvalid\\n-----END PUBLIC KEY-----';

    const payload = Buffer.from('{"id":"evt_api_key","type":"order.paid"}', 'utf8');
    const digest = signPayload(payload, privateKeyPem);
    const req = buildReq({
      body: payload,
      digest,
    });
    const res = buildRes();

    conektaWebhookKeysMock.getWebhookKeys.mockResolvedValue({
      data: {
        data: [
          {
            active: true,
            public_key: publicKeyPem,
          },
        ],
      },
    });
    persistEventMock.mockResolvedValue({
      created: false,
      inboxId: 37,
    });

    await conektaEndpoint(req, res);

    expect(conektaWebhookKeysMock.getWebhookKeys).toHaveBeenCalledWith('en', undefined, 100);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('returns 400 when webhook body is not Buffer', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CONEKTA_WEBHOOK_PUBLIC_KEY = publicKeyPem;

    const req = buildReq({
      body: { id: 'evt_1' },
      digest: 'sha-256=irrelevant',
    });
    const res = buildRes();

    await conektaEndpoint(req, res);

    expect(persistEventMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid webhook payload');
  });
});
