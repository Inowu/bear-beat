import NodeRSA from 'node-rsa';
import type { Request } from 'express';
// import { FastifyRequest } from 'fastify';

export const verifyConektaSignature = (req: Request, payload: any) => {
  if (!req.headers.digest) {
    return false;
  }

  const publicKey = new NodeRSA(
    process.env.NODE_ENV === 'production'
      ? (process.env.CONEKTA_SIGNED_KEY as string)
      : (process.env.CONEKTA_SIGNED_TEST_KEY as string),
  );

  const signature = req.headers.digest as string;

  const isValid = publicKey.verify(payload, signature, 'utf8', 'base64');

  return isValid;
};
