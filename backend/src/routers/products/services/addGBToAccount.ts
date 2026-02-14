import { PrismaClient, Users } from '@prisma/client';
import { log } from '../../../server';
import { gbToBytes } from '../../../utils/gbToBytes';
import { extendedAccountPostfix } from '../../../utils/constants';
import { OrderStatus } from '../../subscriptions/interfaces/order-status.interface';
import { SessionUser } from '../../auth/utils/serialize-user';

export const addGBToAccount = async ({
  prisma,
  user,
  orderId,
}: {
  prisma: PrismaClient;
  user: Users | SessionUser;
  orderId: number;
}) => {
  await prisma.$transaction(async (tx) => {
    // Webhooks can be delivered more than once. Lock the row to make this idempotent.
    const rows = (await tx.$queryRaw`
      SELECT id, status, product_id
      FROM product_orders
      WHERE id = ${orderId}
      FOR UPDATE
    `) as Array<{ id: number; status: number; product_id: number }>;

    const order = rows?.[0] ?? null;

    if (!order) {
      log.error(`[PRODUCT:ADD_GB] Order ${orderId} not found`);
      return;
    }

    if (order.status === OrderStatus.PAID) {
      log.info(`[PRODUCT:ADD_GB] Order ${orderId} already paid, skipping.`);
      return;
    }

    const product = await tx.products.findFirst({
      where: { id: order.product_id },
    });

    if (!product) {
      log.error(`[PRODUCT:ADD_GB] Product ${order.product_id} not found`);
      return;
    }

    const ftpAccounts = await tx.ftpUser.findMany({
      where: { user_id: user.id },
    });

    if (!ftpAccounts || ftpAccounts.length === 0) {
      log.error(`[PRODUCT:ADD_GB] User ${user.id} has no FTP accounts`);
      return;
    }

    const subscriptionAccount = ftpAccounts.find(
      (ftpAccount) => !ftpAccount.userid.endsWith(extendedAccountPostfix),
    );

    if (!subscriptionAccount) {
      log.error(
        `[PRODUCT:ADD_GB] User ${user.id} has no subscription FTP account, could not find a non-extended account`,
      );
      return;
    }

    const extendedUserid = `${subscriptionAccount.userid}${extendedAccountPostfix}`;

    let extendedFtpAccount = ftpAccounts.find(
      (ftpAccount) => ftpAccount.userid === extendedUserid,
    );

    if (!extendedFtpAccount) {
      log.info(
        `[PRODUCT:ADD_GB] Creating extended cuota FTP account for user ${user.id}`,
      );

      extendedFtpAccount = await tx.ftpUser.create({
        data: {
          user_id: user.id,
          userid: extendedUserid,
          passwd: subscriptionAccount.passwd,
          homedir: '/home/products/',
          uid: 2001,
          gid: 2001,
        },
      });

      await tx.ftpQuotaLimits.create({
        data: {
          bytes_out_avail: gbToBytes(Number(product.amount)),
          bytes_xfer_avail: 0,
          // A limit of 0 means unlimited
          files_out_avail: 0,
          bytes_in_avail: 1,
          files_in_avail: 1,
          name: extendedFtpAccount.userid,
        },
      });

      await tx.ftpquotatallies.create({
        data: {
          name: extendedFtpAccount.userid,
        },
      });

      await tx.product_orders.update({
        where: { id: orderId },
        data: { status: OrderStatus.PAID },
      });

      log.info(
        `[PRODUCT:ADD_GB] Extended cuota FTP account created, added ${product.amount} GB to user ${user.id}`,
      );
      return;
    }

    let existingLimits = await tx.ftpQuotaLimits.findFirst({
      where: {
        name: extendedFtpAccount.userid,
      },
    });

    if (!existingLimits) {
      log.info(
        `[PRODUCT:ADD_GB] No limits found for user ${user.id}, creating new ftp quota limits`,
      );

      existingLimits = await tx.ftpQuotaLimits.create({
        data: {
          bytes_out_avail: gbToBytes(Number(product.amount)),
          bytes_xfer_avail: 0,
          files_out_avail: 0,
          bytes_in_avail: 1,
          files_in_avail: 1,
          name: extendedFtpAccount.userid,
        },
      });
    }

    const newBytesOutAvail =
      Number(existingLimits.bytes_out_avail) + gbToBytes(Number(product.amount));

    log.info(
      `[PRODUCT:ADD_GB] Adding ${product.amount} GB to user ${user.id}, previous limit was ${existingLimits.bytes_out_avail}`,
    );

    await tx.ftpQuotaLimits.update({
      where: {
        id: existingLimits.id,
      },
      data: {
        bytes_out_avail: newBytesOutAvail,
      },
    });

    await tx.product_orders.update({
      where: { id: orderId },
      data: { status: OrderStatus.PAID },
    });

    log.info(
      `[PRODUCT:ADD_GB] Added ${product.amount} GB to user ${user.id}, new limit is ${newBytesOutAvail}`,
    );
  });
};
