import { t } from "./helpers/createRouter";
import { configsRouter } from "./Config.router";
import { countriesRouter } from "./Countries.router";
import { cuponsRouter } from "./Cupons.router";
import { cuponsusedsRouter } from "./CuponsUsed.router";
import { descargasusersRouter } from "./DescargasUser.router";
import { ftpquotalimitsRouter } from "./FtpQuotaLimits.router";
import { ftpusersRouter } from "./FtpUser.router";
import { loginhistoriesRouter } from "./LoginHistory.router";
import { ordersRouter } from "./Orders.router";
import { plansRouter } from "./Plans.router";
import { rolesRouter } from "./Roles.router";
import { userfilesRouter } from "./UserFiles.router";
import { usersRouter } from "./Users.router";
import { ftpquotatalliesRouter } from "./Ftpquotatallies.router";
import { ftpquotatallieshistoriesRouter } from "./FtpQuotaTalliesHistory.router";

export const appRouter = t.router({
  config: configsRouter,
  countries: countriesRouter,
  cupons: cuponsRouter,
  cuponsused: cuponsusedsRouter,
  descargasuser: descargasusersRouter,
  ftpquotalimits: ftpquotalimitsRouter,
  ftpuser: ftpusersRouter,
  loginhistory: loginhistoriesRouter,
  orders: ordersRouter,
  plans: plansRouter,
  roles: rolesRouter,
  userfiles: userfilesRouter,
  users: usersRouter,
  ftpquotatallies: ftpquotatalliesRouter,
  ftpquotatallieshistory: ftpquotatallieshistoriesRouter
})

