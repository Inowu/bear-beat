import { IAdminFilter } from "./Admin";
import trpc from "../../api";
export const exportUsers = async (filt: IAdminFilter) => {
  let users = [];
  try {
    const body: any = {
      where: {
        email: {
          startsWith: filt.search,
        },
      },
      select: {
        username: true,
        email: true,
        registered_on: true,
        phone: true,
      },
    };

    if (filt.active === 2) {
      users = await trpc.users.findManyUsers.query(body);
    } else if (filt.active === 1) {
      users = await trpc.users.getActiveUsers.query(body);
    } else if (filt.active === 0) {
      users = await trpc.users.getInactiveUsers.query(body);
    } else {
      users = await trpc.users.getCancelledUsers.query(body);
    }
    return users;
  } catch {
    return [];
  }
};
export const exportPayments = async () => {
  try {
    let body: any = {};
    const history = await trpc.checkoutLogs.getCheckoutLogs.query(body);
    return history;
  } catch {
    return [];
  }
};
