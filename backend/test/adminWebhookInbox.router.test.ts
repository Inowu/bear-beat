import { appRouter } from '../src/routers';
import { RolesNames } from '../src/routers/auth/interfaces/roles.interface';
import { enqueueWebhookInboxJob } from '../src/queue/webhookInbox';

jest.mock('../src/queue/webhookInbox', () => ({
  enqueueWebhookInboxJob: jest.fn(),
}));

const enqueueWebhookInboxJobMock = enqueueWebhookInboxJob as jest.Mock;

const createPrismaMock = () => ({
  webhookInboxEvent: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
});

const createCaller = (
  prismaMock: ReturnType<typeof createPrismaMock>,
  role: RolesNames = RolesNames.admin,
) =>
  appRouter.createCaller({
    req: { headers: {} } as any,
    res: {} as any,
    prisma: prismaMock as any,
    session: {
      user: {
        id: 1,
        role,
      } as any,
    },
  });

describe('admin.webhookInbox router', () => {
  beforeEach(() => {
    enqueueWebhookInboxJobMock.mockReset();
  });

  it('lists events with provider/status/q filters and cursor pagination', async () => {
    const prismaMock = createPrismaMock();
    const caller = createCaller(prismaMock);
    const receivedAt = new Date('2026-02-18T10:15:00.000Z');

    prismaMock.webhookInboxEvent.findMany.mockResolvedValue([
      {
        id: 420,
        provider: 'paypal',
        event_id: 'WH-420',
        event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
        status: 'FAILED',
        attempts: 2,
        received_at: receivedAt,
        processed_at: null,
        last_error: 'network_timeout',
      },
    ]);

    const result = await caller.admin.webhookInbox.list({
      provider: 'paypal',
      status: 'FAILED',
      q: 'BILLING.SUBSCRIPTION',
      limit: 1,
      cursor: 500,
    });

    expect(prismaMock.webhookInboxEvent.findMany).toHaveBeenCalledWith({
      where: {
        provider: 'paypal',
        status: 'FAILED',
        id: { lt: 500 },
        OR: [
          { event_type: { contains: 'BILLING.SUBSCRIPTION' } },
          { event_id: { contains: 'BILLING.SUBSCRIPTION' } },
        ],
      },
      take: 1,
      orderBy: {
        id: 'desc',
      },
      select: {
        id: true,
        provider: true,
        event_id: true,
        event_type: true,
        status: true,
        attempts: true,
        received_at: true,
        processed_at: true,
        last_error: true,
      },
    });

    expect(result).toEqual({
      items: [
        {
          id: 420,
          provider: 'paypal',
          eventId: 'WH-420',
          eventType: 'BILLING.SUBSCRIPTION.ACTIVATED',
          status: 'FAILED',
          attempts: 2,
          receivedAt: receivedAt.toISOString(),
          processedAt: null,
          lastError: 'network_timeout',
        },
      ],
      nextCursor: 420,
    });
  });

  it('returns full event detail by id', async () => {
    const prismaMock = createPrismaMock();
    const caller = createCaller(prismaMock);
    const now = new Date('2026-02-18T11:30:00.000Z');

    prismaMock.webhookInboxEvent.findUnique.mockResolvedValue({
      id: 12,
      provider: 'conekta',
      event_id: 'evt_12',
      event_type: 'order.paid',
      livemode: false,
      status: 'PROCESSED',
      attempts: 1,
      received_at: now,
      updated_at: now,
      processed_at: now,
      next_retry_at: null,
      processing_started_at: null,
      payload_hash: 'abc123',
      headers_json: { digest: 'sha-256=abc' },
      payload_raw: '{"id":"evt_12"}',
      last_error: null,
    });

    const result = await caller.admin.webhookInbox.get({ id: 12 });

    expect(result).toEqual({
      id: 12,
      provider: 'conekta',
      eventId: 'evt_12',
      eventType: 'order.paid',
      livemode: false,
      status: 'PROCESSED',
      attempts: 1,
      receivedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      processedAt: now.toISOString(),
      nextRetryAt: null,
      processingStartedAt: null,
      payloadHash: 'abc123',
      headers: { digest: 'sha-256=abc' },
      payloadRaw: '{"id":"evt_12"}',
      lastError: null,
    });
  });

  it('retries FAILED events by setting RECEIVED and enqueueing the job', async () => {
    const prismaMock = createPrismaMock();
    const caller = createCaller(prismaMock);

    prismaMock.webhookInboxEvent.findUnique.mockResolvedValue({
      id: 77,
      status: 'FAILED',
    });
    prismaMock.webhookInboxEvent.updateMany.mockResolvedValue({
      count: 1,
    });
    enqueueWebhookInboxJobMock.mockResolvedValue(true);

    const result = await caller.admin.webhookInbox.retry({ id: 77 });

    expect(prismaMock.webhookInboxEvent.updateMany).toHaveBeenCalledWith({
      where: {
        id: 77,
        status: 'FAILED',
      },
      data: {
        status: 'RECEIVED',
        next_retry_at: null,
        last_error: null,
        processing_started_at: null,
        processed_at: null,
      },
    });
    expect(enqueueWebhookInboxJobMock).toHaveBeenCalledWith({ inboxId: 77 });
    expect(result).toEqual({
      ok: true,
      queued: true,
    });
  });

  it('rejects retry when event status is not FAILED', async () => {
    const prismaMock = createPrismaMock();
    const caller = createCaller(prismaMock);

    prismaMock.webhookInboxEvent.findUnique.mockResolvedValue({
      id: 88,
      status: 'PROCESSED',
    });

    await expect(
      caller.admin.webhookInbox.retry({ id: 88 }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    expect(prismaMock.webhookInboxEvent.updateMany).not.toHaveBeenCalled();
    expect(enqueueWebhookInboxJobMock).not.toHaveBeenCalled();
  });

  it('blocks non-admin users', async () => {
    const prismaMock = createPrismaMock();
    const caller = createCaller(prismaMock, RolesNames.normal);

    await expect(
      caller.admin.webhookInbox.list({}),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
