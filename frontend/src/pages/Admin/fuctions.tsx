import { IAdminFilter } from "./Admin";
import trpc from "../../api";
export const exportUsers = async (filt: IAdminFilter) => {
  let users = [];
  try {
    if (filt.active === 2) {
      let body: any = {
        where: {
          email: {
            startsWith: filt.search,
          },
        },
        select: {
          username: true,
          email: true,
          registered_on: true,
        },
      };
      users = await trpc.users.findManyUsers.query(body);
    } else {
      if (filt.active === 1) {
        let body: any = {
          where: {
            email: {
              startsWith: filt.search,
            },
          },
          select: {
            username: true,
            email: true,
            registered_on: true,
          },
        };
        users = await trpc.users.getActiveUsers.query(body);
      } else {
        let body: any = {
          where: {
            email: {
              startsWith: filt.search,
            },
          },
          select: {
            username: true,
            email: true,
            registered_on: true,
          },
        };
        users = await trpc.users.getInactiveUsers.query(body);
      }
    }
    return users;
  } catch (error) {
    console.log(error);
  }
};
export const exportPayments = async () => {
  try {
    let body: any = {};
    const history = await trpc.checkoutLogs.getCheckoutLogs.query(body);
    return history;
  } catch (error: any) {
    console.log(error.message);
  }
};
