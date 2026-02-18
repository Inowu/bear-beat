import { prisma } from "../src/db";
import { router } from "../src/trpc";
import { checkoutLogsRouter } from "../src/routers/CheckoutLogs.router";
import { RolesNames } from "../src/routers/auth/interfaces/roles.interface";

jest.setTimeout(60_000);

describe("checkoutLogs.getCheckoutLeads", () => {
  const testRouter = router({
    checkoutLogs: checkoutLogsRouter,
  });

  const now = Date.now();
  const abandonedEmail = `jest-checkout-leads-abandoned-${now}@local.test`;
  const recoveredEmail = `jest-checkout-leads-recovered-${now}@local.test`;
  const abandonedUsername = `jest-chk-abnd-${now}`;
  const recoveredUsername = `jest-chk-rcv-${now}`;

  let abandonedUserId = 0;
  let recoveredUserId = 0;

  const buildAdminCaller = () =>
    testRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      prisma,
      session: {
        user: {
          id: recoveredUserId,
          role: RolesNames.admin,
          username: recoveredUsername,
          phone: null,
          verified: true,
          email: recoveredEmail,
          profileImg: null,
          stripeCusId: null,
        },
      },
    });

  beforeAll(async () => {
    await prisma.roles.upsert({
      where: { name: RolesNames.admin },
      update: {},
      create: { name: RolesNames.admin },
    });

    const [abandonedUser, recoveredUser] = await Promise.all([
      prisma.users.upsert({
        where: { email: abandonedEmail },
        update: {
          username: abandonedUsername,
          password: "jest-password-not-used",
          active: 1,
          verified: true,
          blocked: false,
          role_id: 1,
        },
        create: {
          username: abandonedUsername,
          email: abandonedEmail,
          password: "jest-password-not-used",
          active: 1,
          verified: true,
          blocked: false,
          role_id: 1,
        },
      }),
      prisma.users.upsert({
        where: { email: recoveredEmail },
        update: {
          username: recoveredUsername,
          password: "jest-password-not-used",
          active: 1,
          verified: true,
          blocked: false,
          role_id: 1,
        },
        create: {
          username: recoveredUsername,
          email: recoveredEmail,
          password: "jest-password-not-used",
          active: 1,
          verified: true,
          blocked: false,
          role_id: 1,
        },
      }),
    ]);

    abandonedUserId = abandonedUser.id;
    recoveredUserId = recoveredUser.id;
  });

  beforeEach(async () => {
    await prisma.orders.deleteMany({
      where: {
        user_id: {
          in: [abandonedUserId, recoveredUserId],
        },
      },
    });
    await prisma.checkout_logs.deleteMany({
      where: {
        user_id: {
          in: [abandonedUserId, recoveredUserId],
        },
      },
    });

    const nowDate = Date.now();
    const abandonedCheckoutDate = new Date(nowDate - 1000 * 60 * 60 * 6);
    const recoveredCheckoutDate = new Date(nowDate - 1000 * 60 * 60 * 4);

    await prisma.checkout_logs.createMany({
      data: [
        {
          user_id: abandonedUserId,
          last_checkout_date: abandonedCheckoutDate,
        },
        {
          user_id: recoveredUserId,
          last_checkout_date: recoveredCheckoutDate,
        },
      ],
    });

    await prisma.orders.create({
      data: {
        user_id: recoveredUserId,
        date_order: new Date(recoveredCheckoutDate.getTime() + 1000 * 60 * 10),
        total_price: 350,
        status: 1,
        is_plan: 1,
        payment_method: "card",
        is_canceled: 0,
      },
    });
  });

  afterAll(async () => {
    await prisma.orders
      .deleteMany({
        where: {
          user_id: {
            in: [abandonedUserId, recoveredUserId],
          },
        },
      })
      .catch(() => null);

    await prisma.checkout_logs
      .deleteMany({
        where: {
          user_id: {
            in: [abandonedUserId, recoveredUserId],
          },
        },
      })
      .catch(() => null);

    await prisma.users
      .deleteMany({
        where: {
          email: {
            in: [abandonedEmail, recoveredEmail],
          },
        },
      })
      .catch(() => null);
  });

  it("keeps summary and total aligned with the selected status filter", async () => {
    const caller = buildAdminCaller();

    const abandoned = await caller.checkoutLogs.getCheckoutLeads({
      page: 0,
      limit: 50,
      status: "abandoned",
      days: 30,
    });

    expect(abandoned.total).toBe(abandoned.summary.totalCandidates);
    expect(abandoned.summary.abandoned).toBe(abandoned.total);
    expect(abandoned.summary.recovered).toBe(0);
    expect(abandoned.items).toHaveLength(1);
    expect(abandoned.items[0]?.leadStatus).toBe("abandoned");

    const recovered = await caller.checkoutLogs.getCheckoutLeads({
      page: 0,
      limit: 50,
      status: "recovered",
      days: 30,
    });

    expect(recovered.total).toBe(recovered.summary.totalCandidates);
    expect(recovered.summary.recovered).toBe(recovered.total);
    expect(recovered.summary.abandoned).toBe(0);
    expect(recovered.items).toHaveLength(1);
    expect(recovered.items[0]?.leadStatus).toBe("recovered");
  });
});
