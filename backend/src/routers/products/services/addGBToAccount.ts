import { PrismaClient, Users } from '@prisma/client';
import { log } from '../../../server';
import { gbToBytes } from '../../../utils/gbToBytes';
import { extendedAccountPostfix } from '../../../utils/constants';
import { OrderStatus } from '../../subscriptions/interfaces/order-status.interface';

export const addGBToAccount = async ({
  prisma,
  user,
  orderId,
}: {
  prisma: PrismaClient;
  user: Users;
  orderId: number;
}) => {
  const order = await prisma.product_orders.findFirst({
    where: {
      id: orderId,
    },
  });

  if (!order) {
    log.error(`[PRODUCT:ADD_GB] Order ${orderId} not found`);
    return;
  }

  const product = await prisma.products.findFirst({
    where: {
      id: order.product_id,
    },
  });

  if (!product) {
    log.error(`[PRODUCT:ADD_GB] Product ${order.product_id} not found`);
    return;
  }

  const ftpAccounts = await prisma.ftpUser.findMany({
    where: {
      user_id: user.id,
    },
  });

  if (!ftpAccounts) {
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

  let extendedFtpAccount = ftpAccounts.find(
    (ftpAccount) =>
      ftpAccount.userid ===
      `${subscriptionAccount.userid}-${extendedAccountPostfix}`,
  );

  if (!extendedFtpAccount) {
    log.info(
      `[PRODUCT:ADD_GB] Creating extended cuota FTP account for user ${user.id}`,
    );

    const ftpAccount = ftpAccounts[0];

    extendedFtpAccount = await prisma.ftpUser.create({
      data: {
        user_id: user.id,
        userid: `${ftpAccount.userid}${extendedAccountPostfix}`,
        passwd: ftpAccount.passwd,
        homedir: '/home/products/',
        uid: 2001,
        gid: 2001,
      },
    });

    await prisma.ftpQuotaLimits.create({
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

    await prisma.ftpquotatallies.create({
      data: {
        name: extendedFtpAccount.userid,
      },
    });

    log.info(
      `[PRODUCT:ADD_GB] Extended cuota FTP account created, added ${product.amount} GB to user ${user.id}`,
    );
    return;
  }

  let existingLimits = await prisma.ftpQuotaLimits.findFirst({
    where: {
      name: extendedFtpAccount.userid,
    },
  });

  if (!existingLimits) {
    log.info(
      `[PRODUCT:ADD_GB] No limits found for user ${user.id}, creating new ftp quota limits`,
    );

    existingLimits = await prisma.ftpQuotaLimits.create({
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

  await prisma.ftpQuotaLimits.update({
    where: {
      id: existingLimits.id,
    },
    data: {
      bytes_out_avail: newBytesOutAvail,
    },
  });

  await prisma.product_orders.update({
    where: {
      id: orderId,
    },
    data: {
      status: OrderStatus.PAID,
    },
  });

  log.info(
    `[PRODUCT:ADD_GB] Added ${product.amount} GB to user ${user.id}, new limit is ${newBytesOutAvail}`,
  );
};
