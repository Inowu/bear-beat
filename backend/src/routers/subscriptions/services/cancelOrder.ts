import { PrismaClient } from '@prisma/client';
import { log } from '../../../server';
import { OrderStatus } from '../interfaces/order-status.interface';

export const cancelOrder = async ({
  prisma,
  orderId,
  isProduct = false,
  reason = OrderStatus.CANCELLED,
}: {
  prisma: PrismaClient;
  orderId?: number;
  isProduct?: boolean;
  reason?: OrderStatus;
}) => {
  if (!orderId) {
    log.warn('[CANCEL_ORDER] Called without orderId');
    return;
  }

  const order = await prisma.orders.findFirst({
    where: {
      id: orderId,
    },
  });

  if (!order) {
    log.warn('[CANCEL_ORDER] Order not found');
    return;
  }

  if (isProduct) {
    await prisma.product_orders.update({
      where: {
        id: orderId,
      },
      data: {
        status: reason,
      },
    });
  } else {
    await prisma.orders.update({
      where: {
        id: orderId,
      },
      data: {
        status: reason,
      },
    });
  }
};
