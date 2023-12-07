import { PrismaClient } from '@prisma/client';
import { log } from '../../../server';
import { OrderStatus } from '../interfaces/order-status.interface';

export const cancelOrder = async ({
  prisma,
  orderId,
  isProduct = false,
}: {
  prisma: PrismaClient;
  orderId?: number;
  isProduct?: boolean;
}) => {
  if (!orderId) {
    log.warn('No orderId found on cancelOrder handler');
    return;
  }

  const order = await prisma.orders.findFirst({
    where: {
      id: orderId,
    },
  });

  if (!order) {
    log.warn(`No order found in cancelOrder handler for id ${orderId}`);
    return;
  }

  if (isProduct) {
    await prisma.product_orders.update({
      where: {
        id: orderId,
      },
      data: {
        status: OrderStatus.CANCELLED,
      },
    });
  } else {
    await prisma.orders.update({
      where: {
        id: orderId,
      },
      data: {
        status: OrderStatus.CANCELLED,
      },
    });
  }
};
