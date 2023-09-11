import { inferAsyncReturnType } from '@trpc/server';
// import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../db';
import { SessionUser } from '../routers/auth/utils/serialize-user';

export const createContext = async ({
  req,
  res,
}: CreateExpressContextOptions): Promise<{
  req: CreateExpressContextOptions['req'];
  res: CreateExpressContextOptions['res'];
  prisma: PrismaClient;
  session: null | { user: SessionUser | null };
}> => {
  const token = req.headers.authorization?.split(' ')[1];
  let user: SessionUser | null;

  try {
    user = token
      ? (jwt.verify(token, process.env.JWT_SECRET as string) as SessionUser)
      : null;
  } catch (e) {
    return { req, res, prisma, session: null };
  }

  return { req, res, session: { user }, prisma };
};

export type Context = inferAsyncReturnType<typeof createContext>;
