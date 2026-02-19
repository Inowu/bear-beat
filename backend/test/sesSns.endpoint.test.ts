import type { Request, Response } from 'express';
import { sesSnsEndpoint } from '../src/endpoints/webhooks/sesSns.endpoint';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    emailDeliveryEvent: {
      create: jest.fn(),
    },
    automationActionLog: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const prismaMock = prisma as unknown as {
  emailDeliveryEvent: {
    create: jest.Mock;
  };
  automationActionLog: {
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const buildReq = (body: unknown): Request =>
  ({
    body,
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

describe('sesSnsEndpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.emailDeliveryEvent.create.mockResolvedValue({ id: 1 });
    prismaMock.automationActionLog.findMany.mockResolvedValue([]);
    prismaMock.automationActionLog.update.mockResolvedValue({ id: 1 });
  });

  it('returns 400 when payload is invalid', async () => {
    const req = buildReq('not-json');
    const res = buildRes();

    await sesSnsEndpoint(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid SNS payload');
    expect(prismaMock.emailDeliveryEvent.create).not.toHaveBeenCalled();
  });

  it('processes SNS envelope notifications', async () => {
    prismaMock.automationActionLog.findMany.mockResolvedValue([
      { id: 77, delivery_status: 'sent' },
    ]);

    const req = buildReq(JSON.stringify({
      Type: 'Notification',
      MessageId: 'sns-message-001',
      Timestamp: '2026-02-19T20:30:00.000Z',
      Message: JSON.stringify({
        eventType: 'Delivery',
        mail: {
          messageId: 'ses-message-001',
          timestamp: '2026-02-19T20:29:58.000Z',
          tags: {
            template_key: ['welcome'],
            action_key: ['transactional_welcome'],
            stage: ['0'],
          },
        },
        delivery: {
          timestamp: '2026-02-19T20:29:59.000Z',
        },
      }),
    }));
    const res = buildRes();

    await sesSnsEndpoint(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
    expect(prismaMock.emailDeliveryEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        provider: 'ses',
        provider_event_id: 'sns-message-001',
        provider_message_id: 'ses-message-001',
        event_type: 'delivered',
        template_key: 'welcome',
        action_key: 'transactional_welcome',
        stage: 0,
      }),
    }));
    expect(prismaMock.automationActionLog.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 77 },
      data: { delivery_status: 'delivered' },
    }));
  });

  it('processes direct raw SES payload notifications', async () => {
    const req = buildReq(JSON.stringify({
      eventType: 'Open',
      mail: {
        messageId: 'ses-message-raw-001',
        timestamp: '2026-02-19T20:35:00.000Z',
        tags: {
          template_key: ['automation_plans_offer_stage_1'],
          action_key: ['plans_view_no_checkout_email'],
          stage: ['1'],
        },
      },
      open: {
        timestamp: '2026-02-19T20:35:10.000Z',
      },
    }));
    const res = buildRes();

    await sesSnsEndpoint(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
    expect(prismaMock.emailDeliveryEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        provider: 'ses',
        provider_event_id: expect.stringMatching(/^raw_[a-f0-9]{64}$/),
        provider_message_id: 'ses-message-raw-001',
        event_type: 'opened',
        template_key: 'automation_plans_offer_stage_1',
        action_key: 'plans_view_no_checkout_email',
        stage: 1,
      }),
    }));
  });
});
