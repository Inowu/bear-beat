import { inferAsyncReturnType } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../db';
import { SessionUser } from '../routers/auth/utils/serialize-user';

export const createContext = async ({
  req,
  res,
}: CreateFastifyContextOptions): Promise<{
  req: CreateFastifyContextOptions['req'];
  res: CreateFastifyContextOptions['res'];
  prisma: PrismaClient;
  session: null | { user: SessionUser | null };
}> => {
  const token = req.headers.authorization?.replace('Bearer ', '');
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
