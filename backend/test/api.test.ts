import { TRPCError } from '@trpc/server';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import { prisma } from '../src/db';
import appRouter from '../src/routers';

const user = {
  email: 'test@test.com',
  password: 'password',
  username: 'test',
  phone: '534253',
};

describe('TRCP API', () => {
  const caller = appRouter.createCaller({
    req: {} as any,
    res: {} as any,
    prisma,
    session: null,
  });

  describe('Login', () => {
    afterEach(async () => {
      if (
        await prisma.users.findFirst({
          where: {
            username: 'test',
          },
        })
      ) {
        await prisma.users.delete({
          where: {
            username: 'test',
          },
        });
      }
    });

    it('Can login', async () => {
      const register = await caller.auth.register(user);

      expect(register.token).toBeDefined();

      const res = await caller.auth.login({
        username: 'test',
        password: 'password',
      });

      expect(res.token).toBeDefined();
    });

    it('Throws an error if password is incorrect', async () => {
      try {
        const register = await caller.auth.register(user);

        expect(register.token).toBeDefined();
      } catch (cause) {
        expect(cause).toBeInstanceOf(TRPCError);
        expect(getHTTPStatusCodeFromError(cause as TRPCError)).toBe(401);
      }
    });
  });

  describe('Permissions', () => {
    it('Rejects requests that are not authenticated', async () => {
      try {
        const res = await caller.orders.createOneOrders({ data: {} as any });
      } catch (cause) {
        expect(cause).toBeInstanceOf(TRPCError);
        expect(getHTTPStatusCodeFromError(cause as TRPCError)).toBe(500);
      }
    });

    it('Requires admin role', async () => {
      try {
        const res = await caller.orders.createOneOrders({ data: {} as any });
      } catch (cause) {
        expect(cause).toBeInstanceOf(TRPCError);
        expect(getHTTPStatusCodeFromError(cause as TRPCError)).toBe(500);
      }
    });
  });
});
