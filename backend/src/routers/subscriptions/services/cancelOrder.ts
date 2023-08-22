import { PrismaClient } from '@prisma/client';
import { log } from '../../../server';
import { OrderStatus } from '../interfaces/order-status.interface';

export const cancelOrder = async ({
  prisma,
  orderId,
}: {
  prisma: PrismaClient;
  orderId?: number;
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

  await prisma.orders.update({
    where: {
      id: orderId,
    },
    data: {
      status: OrderStatus.CANCELED,
    },
  });
};
