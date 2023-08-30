import { TRPCError } from '@trpc/server';
import {
  getHTTPStatusCode,
  getHTTPStatusCodeFromError,
} from '@trpc/server/http';
import { prisma } from '../src/db';
import { appRouter } from '../src/routers';
import { RolesNames } from '../src/routers/auth/interfaces/roles.interface';
import { addMonths, subMonths } from 'date-fns';
import { fileService, initializeFileService } from '../src/ftp';

jest.setTimeout(100000);

const path =
  '01 Audios Enero 2023/Alternativo/Zedd, Maren Morris n Beauz - Make You Say [Xtendz].mp3';

const user = {
  email: 'test@test.com',
  password: 'password',
  username: 'test',
  phone: '534253',
  role: RolesNames.normal,
  profileImg: '',
  id: 1,
};

describe('TRCP API', () => {
  const caller = appRouter.createCaller({
    req: {} as any,
    res: {} as any,
    prisma,
    session: null,
  });

  const authCaller = appRouter.createCaller({
    req: {} as any,
    res: {} as any,
    prisma,
    session: {
      user,
    },
  });

  beforeAll(async () => {
    await initializeFileService();
  });

  afterAll(async () => {
    await fileService.end();
  });

  beforeEach(async () => {
    if (
      !(await prisma.users.findFirst({
        where: {
          username: user.username,
        },
      }))
    ) {
      return caller.auth.register(user);
    }
  });

  afterEach(async () => {
    return afterEachCleanup();
  });

  describe('Login', () => {
    it('Can login', async () => {
      const res = await caller.auth.login({
        username: user.username,
        password: user.password,
      });

      expect(res.token).toBeDefined();
    });

    it('Throws an error if password is incorrect', async () => {
      try {
        await caller.auth.login({
          username: user.username,
          password: 'incorrect',
        });
      } catch (cause) {
        expect(cause).toBeInstanceOf(TRPCError);
        expect(getHTTPStatusCodeFromError(cause as TRPCError)).toBe(401);
      }
    });
  });

  describe('Permissions', () => {
    it('Rejects requests that are not authenticated', async () => {
      try {
        await caller.orders.createOneOrders({ data: {} as any });
      } catch (cause) {
        expect(cause).toBeInstanceOf(TRPCError);
        expect(getHTTPStatusCodeFromError(cause as TRPCError)).toBe(500);
      }
    });

    it('Requires admin role', async () => {
      try {
        await authCaller.orders.createOneOrders({ data: {} as any });
      } catch (cause) {
        console.log(cause);
        expect(cause).toBeInstanceOf(TRPCError);
        expect(getHTTPStatusCodeFromError(cause as TRPCError)).toBe(500);
      }
    });

    it('subscribeWithCashConekta - isLoggedIn', async () => {
      try {
        await caller.subscriptions.subscribeWithCashConekta({
          planId: 1,
          paymentMethod: 'spei',
        });
      } catch (e: any) {
        console.log(e);
        expect(getHTTPStatusCodeFromError(e)).toBe(500);
      }
    });
  });

  describe('Download', () => {
    it('Allows the user to download content if the user has enough bytes available and an active plan', async () => {
      await prisma.ftpQuotaLimits.create({
        data: {
          name: user.username,
          bytes_out_avail: 1024 * 1024 * 1024, // 1GB
        },
      });

      await prisma.ftpquotatallies.create({
        data: {
          name: user.username,
        },
      });

      const dbUser = await prisma.users.findFirst({
        where: {
          username: user.username,
        },
      });

      if (!dbUser) throw new Error('User not found');

      await prisma.descargasUser.create({
        data: {
          available: 0,
          date_end: addMonths(new Date(), 1).toISOString(),
          user_id: dbUser.id,
        },
      });

      const localCaller = appRouter.createCaller({
        prisma,
        req: {} as any,
        res: {} as any,
        session: {
          user: {
            ...user,
            id: dbUser.id,
          },
        },
      });

      const res = await localCaller.ftp.download({
        path,
      });

      expect(res.file).not.toBeUndefined();
    });

    it('Requires the user to have quotas registered on the database', async () => {
      try {
        await authCaller.ftp.download({
          path,
        });
      } catch (e) {
        expect(getHTTPStatusCodeFromError(e as TRPCError)).toBe(400);
      }
    });

    it('Requires the user to have enough available bytes left', async () => {
      await prisma.ftpQuotaLimits.create({
        data: {
          name: user.username,
          bytes_out_avail: 0,
        },
      });

      await prisma.ftpquotatallies.create({
        data: {
          name: user.username,
        },
      });

      const dbUser = await prisma.users.findFirst({
        where: {
          username: user.username,
        },
      });

      if (!dbUser) throw new Error('User not found');

      await prisma.descargasUser.create({
        data: {
          available: 0,
          date_end: addMonths(new Date(), 1).toISOString(),
          user_id: dbUser.id,
        },
      });

      const localCaller = appRouter.createCaller({
        prisma,
        req: {} as any,
        res: {} as any,
        session: {
          user: {
            ...user,
            id: dbUser.id,
          },
        },
      });

      try {
        await localCaller.ftp.download({
          path,
        });
      } catch (e) {
        expect(getHTTPStatusCodeFromError(e as TRPCError)).toBe(400);
      }
    });

    it('Requires the user to have an active plan', async () => {
      await prisma.ftpQuotaLimits.create({
        data: {
          name: user.username,
          bytes_out_avail: 1024 * 1024 * 1024,
        },
      });

      await prisma.ftpquotatallies.create({
        data: {
          name: user.username,
        },
      });

      const dbUser = await prisma.users.findFirst({
        where: {
          username: user.username,
        },
      });

      if (!dbUser) throw new Error('User not found');

      await prisma.descargasUser.create({
        data: {
          available: 0,
          date_end: subMonths(new Date(), 1).toISOString(),
          user_id: dbUser.id,
        },
      });

      const localCaller = appRouter.createCaller({
        prisma,
        req: {} as any,
        res: {} as any,
        session: {
          user: {
            ...user,
            id: dbUser.id,
          },
        },
      });

      try {
        await localCaller.ftp.download({
          path,
        });
      } catch (e) {
        expect(getHTTPStatusCodeFromError(e as TRPCError)).toBe(400);
      }
    });

    it('Updates the used bytes and the available bytes after successfully downloading the file', async () => {
      const quotalimits = await prisma.ftpQuotaLimits.create({
        data: {
          name: user.username,
          bytes_out_avail: 1024 * 1024 * 1024,
        },
      });

      const quotatallies = await prisma.ftpquotatallies.create({
        data: {
          name: user.username,
        },
      });

      const dbUser = await prisma.users.findFirst({
        where: {
          username: user.username,
        },
      });

      if (!dbUser) throw new Error('User not found');

      await prisma.descargasUser.create({
        data: {
          available: 0,
          date_end: addMonths(new Date(), 1).toISOString(),
          user_id: dbUser.id,
        },
      });

      const localCaller = appRouter.createCaller({
        prisma,
        req: {} as any,
        res: {} as any,
        session: {
          user: {
            ...user,
            id: dbUser.id,
          },
        },
      });

      const res = await localCaller.ftp.download({
        path,
      });

      expect(res.file).not.toBeUndefined();

      const updatedQuotaLimits = await prisma.ftpQuotaLimits.findFirst({
        where: {
          id: quotalimits.id,
        },
      });

      const updatedQuotaTallies = await prisma.ftpquotatallies.findFirst({
        where: {
          id: quotatallies.id,
        },
      });

      expect(updatedQuotaLimits?.bytes_out_avail).toBe(
        quotalimits.bytes_out_avail - BigInt(res.size),
      );
      expect(updatedQuotaTallies?.bytes_out_used).toBe(
        quotatallies.bytes_out_used + BigInt(res.size),
      );
    });

    it('Download demo', async () => {
      const res = await authCaller.ftp.demo({
        path,
      });

      expect(res.demo).not.toBeUndefined();
    });
  });
});

const afterEachCleanup = async () => {
  const dbUser = await prisma.users.findFirst({
    where: {
      username: user.username,
    },
  });

  if (!dbUser) return;

  const quotatallies = await prisma.ftpquotatallies.findFirst({
    where: {
      name: user.username,
    },
  });

  if (quotatallies) {
    await prisma.ftpquotatallies.delete({
      where: {
        id: quotatallies.id,
      },
    });
  }

  const quotalimits = await prisma.ftpQuotaLimits.findFirst({
    where: {
      name: user.username,
    },
  });

  if (quotalimits) {
    await prisma.ftpQuotaLimits.delete({
      where: {
        id: quotalimits.id,
      },
    });
  }
};
