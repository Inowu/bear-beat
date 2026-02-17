import { prisma } from "../src/db";
import { router } from "../src/trpc";
import { checkoutLogsRouter } from "../src/routers/CheckoutLogs.router";
import { RolesNames } from "../src/routers/auth/interfaces/roles.interface";

jest.setTimeout(60_000);

describe("checkoutLogs.registerCheckoutLog", () => {
  const testRouter = router({
    checkoutLogs: checkoutLogsRouter,
  });

  const now = Date.now();
  const email = `jest-checkout-log-${now}@local.test`;
  const username = `jest-checkout-log-${now}`;
  let userId = 0;

  const unauthCaller = testRouter.createCaller({
    req: { headers: {} } as any,
    res: {} as any,
    prisma,
    session: null,
  });

  const authCaller = () =>
    testRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      prisma,
      session: {
        user: {
          id: userId,
          role: RolesNames.normal,
          username,
          phone: null,
          verified: true,
          email,
          profileImg: null,
          stripeCusId: null,
        },
      },
    });

  beforeAll(async () => {
    await prisma.roles.upsert({
      where: { name: RolesNames.normal },
      update: {},
      create: { name: RolesNames.normal },
    });

    const user = await prisma.users.upsert({
      where: { email },
      update: {
        username,
        password: "jest-password-not-used",
        active: 1,
        verified: true,
        blocked: false,
      },
      create: {
        username,
        email,
        password: "jest-password-not-used",
        active: 1,
        verified: true,
        blocked: false,
      },
    });
    userId = user.id;
  });

  beforeEach(async () => {
    await prisma.checkout_logs.deleteMany({
      where: { user_id: userId },
    });
  });

  afterAll(async () => {
    await prisma.checkout_logs
      .deleteMany({
        where: { user_id: userId },
      })
      .catch(() => null);
    await prisma.users
      .deleteMany({
        where: { email },
      })
      .catch(() => null);
  });

  it("returns no-op when no authenticated user is present", async () => {
    const before = await prisma.checkout_logs.count({
      where: { user_id: userId },
    });

    const result = await unauthCaller.checkoutLogs.registerCheckoutLog();

    const after = await prisma.checkout_logs.count({
      where: { user_id: userId },
    });

    expect(result.recorded).toBe(false);
    expect(after).toBe(before);
  });

  it("creates (and then updates) checkout log when session user exists", async () => {
    const caller = authCaller();

    const first = await caller.checkoutLogs.registerCheckoutLog();
    expect(first.recorded).toBe(true);

    const afterFirst = await prisma.checkout_logs.findMany({
      where: { user_id: userId },
      orderBy: { id: "asc" },
    });
    expect(afterFirst).toHaveLength(1);
    const firstDate = afterFirst[0]!.last_checkout_date;

    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const second = await caller.checkoutLogs.registerCheckoutLog();
    expect(second.recorded).toBe(true);

    const afterSecond = await prisma.checkout_logs.findMany({
      where: { user_id: userId },
      orderBy: { id: "asc" },
    });
    expect(afterSecond).toHaveLength(1);
    expect(afterSecond[0]!.last_checkout_date.getTime()).toBeGreaterThanOrEqual(firstDate.getTime());
  });
});
