import { TRPCError } from '@trpc/server';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import { prisma } from '../src/db';
import { authRouter } from '../src/routers/auth';
import { router } from '../src/trpc';

jest.setTimeout(60_000);

describe('auth.startTrialByEmail', () => {
  const testRouter = router({
    auth: authRouter,
  });
  const caller = testRouter.createCaller({
    req: { headers: {} } as any,
    res: {} as any,
    prisma,
    session: null,
  });

  const prefix = `jest-trial-gate-${Date.now()}`;
  const turnstileBypassToken = '__TURNSTILE_LOCAL_BYPASS__';
  const previousTrialDays = process.env.BB_TRIAL_DAYS;
  const previousTrialGb = process.env.BB_TRIAL_GB;

  beforeAll(() => {
    process.env.BB_TRIAL_DAYS = '7';
    process.env.BB_TRIAL_GB = '100';
  });

  beforeAll(async () => {
    // Some local test databases are created from historical snapshots that do not include
    // `deleted_users`. Keep this suite self-contained.
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS deleted_users (
        id INT NOT NULL AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL,
        deletionDate DATETIME NOT NULL,
        reactivated BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (id)
      )
    `);
  });

  afterAll(async () => {
    process.env.BB_TRIAL_DAYS = previousTrialDays;
    process.env.BB_TRIAL_GB = previousTrialGb;

    const users = await prisma.users.findMany({
      where: { email: { startsWith: prefix } },
      select: { id: true },
    });
    const userIds = users.map((row) => row.id);

    if (userIds.length > 0) {
      await prisma.orders.deleteMany({
        where: { user_id: { in: userIds } },
      });
      await prisma.users.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    await prisma.deletedUsers.deleteMany({
      where: { email: { startsWith: prefix } },
    });
  });

  const createUser = async (params: {
    suffix: string;
    blocked?: boolean;
    trialUsedAt?: Date | null;
    phone?: string | null;
  }) => {
    const suffix = params.suffix;
    const uniqueUsername = `${suffix}-${Date.now().toString(36)}-${Math.floor(
      Math.random() * 1_000_000,
    )
      .toString()
      .padStart(6, '0')}`.slice(0, 40);
    return prisma.users.create({
      data: {
        username: uniqueUsername,
        email: `${prefix}-${suffix}@local.test`,
        password:
          '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        active: 1,
        verified: true,
        blocked: Boolean(params.blocked),
        registered_on: new Date(),
        trial_used_at: params.trialUsedAt ?? null,
        phone: params.phone ?? null,
      },
      select: { id: true, email: true },
    });
  };

  it('returns register + new_account_trial for a new email when trial is enabled', async () => {
    const email = `${prefix}-new-account@local.test`;
    const res = await caller.auth.startTrialByEmail({
      email,
      turnstileToken: turnstileBypassToken,
    });

    expect(res.nextAction).toBe('register');
    expect(res.accountState).toBe('new');
    expect(res.trialState).toBe('unknown_for_new');
    expect(res.messageKey).toBe('new_account_trial');
    expect(res.ineligibleReason).toBeNull();
    expect(res.trial.enabled).toBe(true);
  });

  it('returns login + welcome_back_trial for an existing eligible account', async () => {
    const user = await createUser({
      suffix: 'eligible',
      phone: `+1${String(Date.now()).slice(-10)}`,
    });

    const res = await caller.auth.startTrialByEmail({
      email: user.email,
      turnstileToken: turnstileBypassToken,
    });

    expect(res.nextAction).toBe('login');
    expect(res.accountState).toBe('existing_active');
    expect(res.trialState).toBe('eligible');
    expect(res.messageKey).toBe('welcome_back_trial');
    expect(res.ineligibleReason).toBeNull();
  });

  it('returns login + welcome_back_no_trial when trial was already used', async () => {
    const user = await createUser({
      suffix: 'trial-used',
      trialUsedAt: new Date(),
    });

    const res = await caller.auth.startTrialByEmail({
      email: user.email,
      turnstileToken: turnstileBypassToken,
    });

    expect(res.nextAction).toBe('login');
    expect(res.accountState).toBe('existing_active');
    expect(res.trialState).toBe('ineligible');
    expect(res.messageKey).toBe('welcome_back_no_trial');
    expect(res.ineligibleReason).toBe('trial_already_used');
  });

  it('returns login + welcome_back_no_trial when account has previous paid plan order', async () => {
    const user = await createUser({
      suffix: 'paid-order',
    });

    await prisma.orders.create({
      data: {
        user_id: user.id,
        date_order: new Date(),
        total_price: 350,
        status: 1,
        is_plan: 1,
        plan_id: null,
      },
    });

    const res = await caller.auth.startTrialByEmail({
      email: user.email,
      turnstileToken: turnstileBypassToken,
    });

    expect(res.nextAction).toBe('login');
    expect(res.accountState).toBe('existing_active');
    expect(res.trialState).toBe('ineligible');
    expect(res.messageKey).toBe('welcome_back_no_trial');
    expect(res.ineligibleReason).toBe('already_paid_member');
  });

  it('returns login + welcome_back_no_trial when another account with same phone already used trial', async () => {
    const sharedPhone = `+1${String(Date.now()).slice(-10)}`;
    await createUser({
      suffix: 'same-phone-source',
      phone: sharedPhone,
      trialUsedAt: new Date(),
    });
    const user = await createUser({
      suffix: 'same-phone-target',
      phone: sharedPhone,
    });

    const res = await caller.auth.startTrialByEmail({
      email: user.email,
      turnstileToken: turnstileBypassToken,
    });

    expect(res.nextAction).toBe('login');
    expect(res.accountState).toBe('existing_active');
    expect(res.trialState).toBe('ineligible');
    expect(res.messageKey).toBe('welcome_back_no_trial');
    expect(res.ineligibleReason).toBe('phone_linked_history');
  });

  it('returns support + blocked_account for blocked users', async () => {
    const user = await createUser({
      suffix: 'blocked',
      blocked: true,
    });

    const res = await caller.auth.startTrialByEmail({
      email: user.email,
      turnstileToken: turnstileBypassToken,
    });

    expect(res.nextAction).toBe('support');
    expect(res.accountState).toBe('existing_blocked');
    expect(res.trialState).toBe('ineligible');
    expect(res.messageKey).toBe('blocked_account');
    expect(res.ineligibleReason).toBeNull();
  });

  it('returns support + deleted_account when email exists in deleted_users', async () => {
    const email = `${prefix}-deleted@local.test`;
    await prisma.deletedUsers.create({
      data: {
        email,
        deletionDate: new Date(),
        reactivated: false,
      },
    });

    const res = await caller.auth.startTrialByEmail({
      email,
      turnstileToken: turnstileBypassToken,
    });

    expect(res.nextAction).toBe('support');
    expect(res.accountState).toBe('existing_deleted');
    expect(res.trialState).toBe('ineligible');
    expect(res.messageKey).toBe('deleted_account');
    expect(res.ineligibleReason).toBeNull();
  });

  it('rejects when token is missing', async () => {
    try {
      await caller.auth.startTrialByEmail({
        email: `${prefix}-missing-token@local.test`,
        turnstileToken: '',
      });
      throw new Error('expected auth.startTrialByEmail to throw');
    } catch (cause) {
      expect(cause).toBeInstanceOf(TRPCError);
      expect(getHTTPStatusCodeFromError(cause as TRPCError)).toBe(400);
    }
  });
});
