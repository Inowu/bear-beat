jest.mock('../src/db', () => ({
  prisma: {
    users: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    plans: {
      findFirst: jest.fn(),
    },
    orders: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    descargasUser: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../src/server', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../src/routers/subscriptions/services/subscribe', () => ({
  subscribe: jest.fn(),
}));

jest.mock('../src/routers/subscriptions/services/cancelSubscription', () => ({
  cancelSubscription: jest.fn(),
}));

jest.mock('../src/routers/subscriptions/services/cancelOrder', () => ({
  cancelOrder: jest.fn(),
}));

jest.mock('../src/email', () => ({
  sendPlanActivatedEmail: jest.fn(),
}));

jest.mock('../src/routers/products/services/addGBToAccount', () => ({
  addGBToAccount: jest.fn(),
}));

jest.mock('../src/many-chat', () => ({
  manyChat: {
    addTagToUser: jest.fn(),
  },
}));

jest.mock('../src/analytics', () => ({
  ingestAnalyticsEvents: jest.fn(),
}));

jest.mock('../src/analytics/paymentSuccess', () => ({
  ingestPaymentSuccessEvent: jest.fn(),
}));

import { prisma } from '../src/db';
import { subscribe } from '../src/routers/subscriptions/services/subscribe';
import { processConektaWebhookPayload } from '../src/routers/webhooks/conekta';

const prismaMock = prisma as unknown as {
  users: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  plans: {
    findFirst: jest.Mock;
  };
  orders: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  descargasUser: {
    findFirst: jest.Mock;
  };
};

const subscribeMock = subscribe as jest.Mock;

const makeOrderPaidPayload = (): any => ({
  id: 'evt_order_paid_1',
  type: 'order.paid',
  data: {
    object: {
      id: 'ord_live_123',
      metadata: {
        orderId: '28044',
        userId: '20467',
      },
      charges: {
        data: [
          {
            id: 'charge_123',
            payment_method: {
              object: 'bank_transfer_payment',
            },
          },
        ],
      },
    },
  },
});

describe('processConektaWebhookPayload order.paid reliability', () => {
  beforeEach(() => {
    prismaMock.users.findFirst.mockReset();
    prismaMock.users.update.mockReset();
    prismaMock.plans.findFirst.mockReset();
    prismaMock.orders.findFirst.mockReset();
    prismaMock.orders.update.mockReset();
    prismaMock.descargasUser.findFirst.mockReset();
    subscribeMock.mockReset();
  });

  it('throws when order.paid cannot resolve user', async () => {
    const payload = makeOrderPaidPayload();
    payload.data.object.metadata.userId = undefined;
    payload.data.object.customer_info = undefined;

    prismaMock.users.findFirst.mockResolvedValue(null);
    prismaMock.orders.findFirst.mockResolvedValue(null);

    await expect(processConektaWebhookPayload(payload)).rejects.toThrow(
      'order.paid could not be matched to any user',
    );
  });

  it('throws when subscribe fails so webhook inbox can retry', async () => {
    const payload = makeOrderPaidPayload();

    prismaMock.users.findFirst.mockResolvedValue({
      id: 20467,
      email: 'masked@example.test',
      username: 'masked-user',
    });
    prismaMock.orders.findFirst.mockResolvedValue({
      id: 28044,
      status: 0,
      plan_id: 33,
      total_price: 350,
    });
    prismaMock.orders.update.mockResolvedValue({
      id: 28044,
      status: 1,
      plan_id: 33,
      total_price: 350,
    });
    prismaMock.plans.findFirst.mockResolvedValue({
      id: 33,
      duration: 30,
      price: 350,
      moneda: 'mxn',
      name: 'Plan Oro',
    });
    subscribeMock.mockRejectedValue(new Error('subscribe write failed'));

    await expect(processConektaWebhookPayload(payload)).rejects.toThrow(
      'subscribe write failed',
    );
  });

  it('throws when no activation row is linked to the paid order', async () => {
    const payload = makeOrderPaidPayload();

    prismaMock.users.findFirst.mockResolvedValue({
      id: 20467,
      email: 'masked@example.test',
      username: 'masked-user',
    });
    prismaMock.orders.findFirst.mockResolvedValue({
      id: 28044,
      status: 0,
      plan_id: 33,
      total_price: 350,
    });
    prismaMock.orders.update.mockResolvedValue({
      id: 28044,
      status: 1,
      plan_id: 33,
      total_price: 350,
    });
    prismaMock.plans.findFirst.mockResolvedValue({
      id: 33,
      duration: 30,
      price: 350,
      moneda: 'mxn',
      name: 'Plan Oro',
    });
    subscribeMock.mockResolvedValue(undefined);
    prismaMock.descargasUser.findFirst.mockResolvedValue(null);

    await expect(processConektaWebhookPayload(payload)).rejects.toThrow(
      'order.paid processed but activation row missing for order 28044',
    );
  });
});
