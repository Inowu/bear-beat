import crypto from 'crypto';
import { TRPCError } from '@trpc/server';
import { addDays } from 'date-fns';
import { z } from 'zod';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { OrderStatus } from '../../subscriptions/interfaces/order-status.interface';
import { subscribe } from '../../subscriptions/services/subscribe';
import { PaymentService } from '../../subscriptions/services/types';
import { hasActiveSubscription } from '../../subscriptions/utils/hasActiveSub';
import { createAdminAuditLog } from '../../utils/adminAuditLog';

const providerSchema = z.enum(['stripe', 'stripe_oxxo', 'paypal', 'conekta']);

type ProviderInput = z.infer<typeof providerSchema>;

const providerToPaymentService: Record<ProviderInput, PaymentService> = {
  stripe: PaymentService.STRIPE,
  stripe_oxxo: PaymentService.STRIPE_OXXO,
  paypal: PaymentService.PAYPAL,
  conekta: PaymentService.CONEKTA,
};

const providerToOrderMethods: Record<ProviderInput, PaymentService[]> = {
  stripe: [
    PaymentService.STRIPE,
    PaymentService.STRIPE_RENOVACION,
    PaymentService.STRIPE_PLAN_CHANGE,
  ],
  stripe_oxxo: [PaymentService.STRIPE_OXXO],
  paypal: [PaymentService.PAYPAL, PaymentService.PAYPAL_PLAN_CHANGE],
  conekta: [PaymentService.CONEKTA],
};

const normalizeReference = (value: string): string => value.trim();

const hashReference = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);

const toOptionalPositiveInt = (value: string): number | null => {
  const asNumber = Number(value);
  if (!Number.isInteger(asNumber) || asNumber <= 0) return null;
  return asNumber;
};

export const activatePlanFromPaymentReference = shieldedProcedure
  .input(
    z.object({
      userId: z.number().int().positive(),
      planId: z.number().int().positive(),
      provider: providerSchema,
      paymentReference: z.string().trim().min(3).max(191),
      createOrderIfMissing: z.boolean().optional().default(false),
    }),
  )
  .mutation(async ({ input, ctx: { prisma, session, req } }) => {
    const paymentReference = normalizeReference(input.paymentReference);
    const orderIdFromReference = toOptionalPositiveInt(paymentReference);
    const paymentService = providerToPaymentService[input.provider];
    const providerMethods = providerToOrderMethods[input.provider];

    const [user, plan] = await Promise.all([
      prisma.users.findFirst({
        where: { id: input.userId },
      }),
      prisma.plans.findFirst({
        where: { id: input.planId },
      }),
    ]);

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Usuario no encontrado',
      });
    }

    if (!plan) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Plan no encontrado',
      });
    }

    await hasActiveSubscription({
      user,
      prisma,
      service: PaymentService.ADMIN,
    });

    const baseReferenceWhere = {
      is_plan: 1,
      OR: [
        { txn_id: paymentReference },
        { invoice_id: paymentReference },
        ...(orderIdFromReference ? [{ id: orderIdFromReference }] : []),
      ],
    };

    const candidateOrders = await prisma.orders.findMany({
      where: {
        AND: [
          baseReferenceWhere,
          {
            OR: [
              { payment_method: { in: providerMethods } },
              { payment_method: null },
            ],
          },
        ],
      },
      orderBy: [{ date_order: 'desc' }, { id: 'desc' }],
      take: 20,
    });

    const matchingOrders = candidateOrders.filter(
      (order) =>
        order.txn_id === paymentReference ||
        order.invoice_id === paymentReference ||
        (orderIdFromReference ? order.id === orderIdFromReference : false),
    );

    const matchForAnotherUser = matchingOrders.find(
      (order) => order.user_id !== user.id,
    );
    const matchForUser = matchingOrders.find((order) => order.user_id === user.id);

    if (matchForAnotherUser && !matchForUser) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'Esa referencia de pago ya está asociada a otro usuario. Verifica antes de activar.',
      });
    }

    let usedExistingOrder = Boolean(matchForUser);
    let createdManualOrder = false;

    const resolvedOrder =
      matchForUser ??
      (input.createOrderIfMissing
        ? await prisma.orders.create({
            data: {
              user_id: user.id,
              plan_id: plan.id,
              is_plan: 1,
              status: OrderStatus.PAID,
              payment_method: paymentService,
              txn_id: paymentReference.length <= 100 ? paymentReference : null,
              invoice_id: paymentReference,
              total_price: Number(plan.price),
              date_order: new Date(),
            },
          })
        : null);

    if (!resolvedOrder) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message:
          'No se encontró una orden con esa referencia para este usuario. Puedes habilitar "crear orden" si confirmaste el pago manualmente.',
      });
    }

    if (!matchForUser) {
      usedExistingOrder = false;
      createdManualOrder = true;
    }

    if (resolvedOrder.is_plan !== 1) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'La referencia encontrada corresponde a una orden que no es de membresía.',
      });
    }

    if (resolvedOrder.plan_id && resolvedOrder.plan_id !== plan.id) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'La referencia encontrada ya está ligada a otro plan. Selecciona el plan correcto para continuar.',
      });
    }

    const patch: {
      status?: number;
      payment_method?: string;
      plan_id?: number;
      is_canceled?: number;
      txn_id?: string | null;
      invoice_id?: string | null;
    } = {};

    if (resolvedOrder.status !== OrderStatus.PAID) patch.status = OrderStatus.PAID;
    if (resolvedOrder.payment_method !== paymentService) patch.payment_method = paymentService;
    if (!resolvedOrder.plan_id) patch.plan_id = plan.id;
    if (resolvedOrder.is_canceled === 1) patch.is_canceled = 0;
    if (!resolvedOrder.txn_id && paymentReference.length <= 100) {
      patch.txn_id = paymentReference;
    }
    if (!resolvedOrder.invoice_id) patch.invoice_id = paymentReference;

    const orderToActivate =
      Object.keys(patch).length > 0
        ? await prisma.orders.update({
            where: { id: resolvedOrder.id },
            data: patch,
          })
        : resolvedOrder;

    const durationDaysRaw = Number(plan.duration);
    const durationDays =
      Number.isFinite(durationDaysRaw) && durationDaysRaw > 0
        ? durationDaysRaw
        : 30;
    const safeSubId =
      paymentReference.length <= 100
        ? paymentReference
        : `manual_ref_${orderToActivate.id}`;

    await subscribe({
      prisma,
      user,
      orderId: orderToActivate.id,
      subId: safeSubId,
      service: paymentService,
      expirationDate: addDays(new Date(), durationDays),
      reusePaidOrderId: true,
    });

    const actorUserId = session?.user?.id;
    if (actorUserId) {
      await createAdminAuditLog({
        prisma,
        req,
        actorUserId,
        action: 'activate_plan_from_payment_reference',
        targetUserId: user.id,
        metadata: {
          provider: input.provider,
          planId: plan.id,
          orderId: orderToActivate.id,
          usedExistingOrder,
          createdManualOrder,
          paymentReferenceHash: hashReference(paymentReference),
        },
      });
    }

    return {
      message: 'Plan activado correctamente a partir del pago validado',
      orderId: orderToActivate.id,
      source: createdManualOrder ? 'created_manual_order' : 'existing_order',
    };
  });
