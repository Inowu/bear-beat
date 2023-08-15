import { router } from '../trpc';
import { configsRouter } from './Config.router';
import { countriesRouter } from './Countries.router';
import { cuponsRouter } from './Cupons.router';
import { cuponsusedsRouter } from './CuponsUsed.router';
import { descargasusersRouter } from './DescargasUser.router';
import { ftpquotalimitsRouter } from './FtpQuotaLimits.router';
import { ftpquotatallieshistoriesRouter } from './FtpQuotatAlliesHistory.router';
import { ftpusersRouter } from './FtpUser.router';
import { loginhistoriesRouter } from './LoginHistory.router';
import { ordersRouter } from './Orders.router';
import { plansRouter } from './Plans.router';
import { rolesRouter } from './Roles.router';
import { userfilesRouter } from './UserFiles.router';
import { usersRouter } from './Users.router';
import { authRouter } from './auth';
import { ftpRouter } from './file-actions';

export const appRouter = router({
  auth: authRouter,
  ftp: ftpRouter,
  config: configsRouter,
  countries: countriesRouter,
  cupons: cuponsRouter,
  cuponsused: cuponsusedsRouter,
  descargasuser: descargasusersRouter,
  ftpquotalimits: ftpquotalimitsRouter,
  ftpquotatallieshistory: ftpquotatallieshistoriesRouter,
  ftpuser: ftpusersRouter,
  loginhistory: loginhistoriesRouter,
  orders: ordersRouter,
  plans: plansRouter,
  roles: rolesRouter,
  userfiles: userfilesRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
