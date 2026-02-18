import { createSign, generateKeyPairSync } from 'crypto';
import type { Request, Response } from 'express';
import { conektaEndpoint } from '../src/endpoints/webhooks/conekta.endpoint';
import {
  verifyConektaSignature,
} from '../src/routers/utils/verifyConektaSignature';
import * as conektaSignatureModule from '../src/routers/utils/verifyConektaSignature';
import * as webhookInboxReceptionModule from '../src/endpoints/webhooks/webhookInboxReception';

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  CONEKTA_SIGNED_KEY: process.env.CONEKTA_SIGNED_KEY,
  CONEKTA_SIGNED_TEST_KEY: process.env.CONEKTA_SIGNED_TEST_KEY,
};

const restoreConektaSignatureEnv = () => {
  if (ORIGINAL_ENV.NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
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
  signer.update(payload);
  signer.end();
  return signer.sign(privateKeyPem).toString('base64');
};

const buildReq = ({
  body,
  digest,
}: {
  body: Buffer | string;
  digest?: string;
}): Request =>
  ({
    body,
    headers: digest ? { digest } : {},
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

describe('verifyConektaSignature', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  const privateKeyPem = toPemString(
    privateKey.export({ format: 'pem', type: 'pkcs1' }),
  );
  const publicKeyPem = toPemString(
    publicKey.export({ format: 'pem', type: 'pkcs1' }),
  );

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.CONEKTA_SIGNED_TEST_KEY = publicKeyPem;
    delete process.env.CONEKTA_SIGNED_KEY;
  });

  afterEach(() => {
    restoreConektaSignatureEnv();
    jest.restoreAllMocks();
  });

  it('returns true when digest matches raw body signature', () => {
    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const digest = signPayload(payload, privateKeyPem);
    const req = buildReq({ body: payload, digest });

    expect(verifyConektaSignature(req)).toBe(true);
  });

  it('accepts digest header normalized as sha-256=<base64>', () => {
    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const digest = signPayload(payload, privateKeyPem);
    const req = buildReq({ body: payload, digest: `sha-256=${digest}` });

    expect(verifyConektaSignature(req)).toBe(true);
  });

  it('returns false when digest does not match body signature', () => {
    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const digest = signPayload(
      Buffer.from('{"id":"evt_2","type":"order.paid"}', 'utf8'),
      privateKeyPem,
    );
    const req = buildReq({ body: payload, digest });

    expect(verifyConektaSignature(req)).toBe(false);
  });

  it('returns false when digest header is missing', () => {
    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const req = buildReq({ body: payload });

    expect(verifyConektaSignature(req)).toBe(false);
  });

  it('returns false when signing key env is missing', () => {
    delete process.env.CONEKTA_SIGNED_TEST_KEY;
    delete process.env.CONEKTA_SIGNED_KEY;

    const payload = Buffer.from('{"id":"evt_1","type":"order.paid"}', 'utf8');
    const digest = signPayload(payload, privateKeyPem);
    const req = buildReq({ body: payload, digest });

    expect(verifyConektaSignature(req)).toBe(false);
  });
});

describe('conektaEndpoint', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    restoreConektaSignatureEnv();
  });

  it('returns 400 and does not process webhook when signature is invalid', async () => {
    const req = buildReq({
      body: Buffer.from('{"id":"evt_1"}', 'utf8'),
      digest: 'invalid-signature',
    });
    const res = buildRes();

    const verifySpy = jest
      .spyOn(conektaSignatureModule, 'verifyConektaSignature')
      .mockReturnValue(false);
    const receptionSpy = jest
      .spyOn(webhookInboxReceptionModule, 'receiveWebhookIntoInbox')
      .mockResolvedValue({ ok: true, duplicate: false });

    await conektaEndpoint(req, res);

    expect(verifySpy).toHaveBeenCalledWith(req);
    expect(receptionSpy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid signature');
  });

  it('returns 200 when signature is valid and processing succeeds', async () => {
    const req = buildReq({
      body: Buffer.from('{"id":"evt_1"}', 'utf8'),
      digest: 'signature',
    });
    const res = buildRes();

    const verifySpy = jest
      .spyOn(conektaSignatureModule, 'verifyConektaSignature')
      .mockReturnValue(true);
    const receptionSpy = jest
      .spyOn(webhookInboxReceptionModule, 'receiveWebhookIntoInbox')
      .mockResolvedValue({ ok: true, duplicate: false });

    await conektaEndpoint(req, res);

    expect(verifySpy).toHaveBeenCalledWith(req);
    expect(receptionSpy).toHaveBeenCalledWith({
      provider: 'conekta',
      req,
      logPrefix: 'CONEKTA_WH',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('returns 400 when webhook payload JSON is invalid', async () => {
    const req = buildReq({
      body: Buffer.from('not-json', 'utf8'),
      digest: 'signature',
    });
    const res = buildRes();

    jest.spyOn(conektaSignatureModule, 'verifyConektaSignature').mockReturnValue(true);
    jest.spyOn(webhookInboxReceptionModule, 'receiveWebhookIntoInbox').mockResolvedValue({
      ok: false,
      status: 400,
      message: 'Invalid JSON payload',
    });

    await conektaEndpoint(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid JSON payload');
  });
});
