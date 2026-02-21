import { appRouter } from '../src/routers';
import { RolesNames } from '../src/routers/auth/interfaces/roles.interface';
import { OrderStatus } from '../src/routers/subscriptions/interfaces/order-status.interface';
import { PaymentService } from '../src/routers/subscriptions/services/types';
import { subscribe } from '../src/routers/subscriptions/services/subscribe';
import { hasActiveSubscription } from '../src/routers/subscriptions/utils/hasActiveSub';
import { createAdminAuditLog } from '../src/routers/utils/adminAuditLog';

jest.mock('../src/routers/subscriptions/services/subscribe', () => ({
  subscribe: jest.fn(),
}));

jest.mock('../src/routers/subscriptions/utils/hasActiveSub', () => ({
  hasActiveSubscription: jest.fn(),
}));

jest.mock('../src/routers/utils/adminAuditLog', () => ({
  createAdminAuditLog: jest.fn(),
}));

const subscribeMock = subscribe as jest.Mock;
const hasActiveSubscriptionMock = hasActiveSubscription as jest.Mock;
const createAdminAuditLogMock = createAdminAuditLog as jest.Mock;

const createPrismaMock = () => ({
  users: {
    findFirst: jest.fn(),
  },
  plans: {
    findFirst: jest.fn(),
  },
  orders: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
});

const createCaller = (prismaMock: ReturnType<typeof createPrismaMock>) =>
  appRouter.createCaller({
    req: { headers: {} } as any,
    res: {} as any,
    prisma: prismaMock as any,
    session: {
      user: {
        id: 9001,
        role: RolesNames.admin,
      } as any,
    },
  });

describe('admin.activatePlanFromPaymentReference', () => {
  beforeEach(() => {
    subscribeMock.mockReset();
    hasActiveSubscriptionMock.mockReset();
    createAdminAuditLogMock.mockReset();
  });

  it('reuses existing Conekta SPEI order without creating a new manual order', async () => {
    const prismaMock = createPrismaMock();
    const caller = createCaller(prismaMock);
    const userId = 10;
    const planId = 20;
    const paymentReference = 'ord_spei_123';

    prismaMock.users.findFirst.mockResolvedValue({
      id: userId,
      role: RolesNames.normal,
    });
    prismaMock.plans.findFirst.mockResolvedValue({
      id: planId,
      duration: 30,
      price: 499,
    });
    prismaMock.orders.findMany.mockResolvedValue([
      {
        id: 777,
        user_id: userId,
        plan_id: planId,
        is_plan: 1,
        status: OrderStatus.PENDING,
        payment_method: 'Conekta spei',
        txn_id: null,
        invoice_id: paymentReference,
        is_canceled: 0,
      },
    ]);
    prismaMock.orders.update.mockResolvedValue({
      id: 777,
      user_id: userId,
      plan_id: planId,
      is_plan: 1,
      status: OrderStatus.PAID,
      payment_method: PaymentService.CONEKTA,
      txn_id: paymentReference,
      invoice_id: paymentReference,
      is_canceled: 0,
    });
    hasActiveSubscriptionMock.mockResolvedValue(null);
    subscribeMock.mockResolvedValue(null);
    createAdminAuditLogMock.mockResolvedValue(null);

    const result = await caller.admin.activatePlanFromPaymentReference({
      userId,
      planId,
      provider: 'conekta',
      paymentReference,
      createOrderIfMissing: false,
    });

    expect(prismaMock.orders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.any(Object),
            {
              OR: [
                {
                  payment_method: {
                    in: expect.arrayContaining([
                      PaymentService.CONEKTA,
                      'Conekta spei',
                      'Conekta cash',
                      'Conekta pay_by_bank',
                    ]),
                  },
                },
                { payment_method: null },
              ],
            },
          ]),
        }),
      }),
    );
    expect(prismaMock.orders.create).not.toHaveBeenCalled();
    expect(prismaMock.orders.update).toHaveBeenCalled();
    expect(subscribeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 777,
        subId: paymentReference,
        service: PaymentService.CONEKTA,
        reusePaidOrderId: true,
      }),
    );
    expect(result).toEqual({
      message: 'Plan activado correctamente a partir del pago validado',
      orderId: 777,
      source: 'existing_order',
    });
  });
});
