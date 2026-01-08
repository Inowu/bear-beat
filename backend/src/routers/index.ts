import { router } from '../trpc';
import { checkoutLogsRouter } from './CheckoutLogs.router';
import { configsRouter } from './Config.router';
import { countriesRouter } from './Countries.router';
import { cuponsRouter } from './Cupons.router';
import { cuponsusedsRouter } from './CuponsUsed.router';
import { descargasusersRouter } from './DescargasUser.router';
import { dirDownloadRouter } from './DirDownload.router';
import { downloadHistoryRouter } from './DownloadHistory.router';
import { blockedEmailDomainsRouter } from './BlockedEmailDomains.router';
import { blockedPhoneNumbersRouter } from './BlockedPhoneNumbers.router';
import { ftpquotalimitsRouter } from './FtpQuotaLimits.router';
import { ftpquotatallieshistoriesRouter } from './FtpQuotatAlliesHistory.router';
import { ftpusersRouter } from './FtpUser.router';
import { ftpquotatalliesRouter } from './Ftpquotatallies.router';
import { loginhistoriesRouter } from './LoginHistory.router';
import { ordersRouter } from './Orders.router';
import { plansRouter } from './Plans.router';
import { rolesRouter } from './Roles.router';
import { userfilesRouter } from './UserFiles.router';
import { usersRouter } from './Users.router';
import { adminRouter } from './admin';
import { authRouter } from './auth';
import { ftpRouter } from './file-actions';
import { migrationRouter } from './migration';
import { productsRouter } from './products';
import { subscriptionsRouter } from './subscriptions';
import { webhooksRouter } from './webhooks';

export const appRouter = router({
  auth: authRouter,
  ftp: ftpRouter,
  subscriptions: subscriptionsRouter,
  webhooks: webhooksRouter,
  admin: adminRouter,
  blockedEmailDomains: blockedEmailDomainsRouter,
  blockedPhoneNumbers: blockedPhoneNumbersRouter,
  config: configsRouter,
  countries: countriesRouter,
  cupons: cuponsRouter,
  cuponsused: cuponsusedsRouter,
  descargasuser: descargasusersRouter,
  ftpquotalimits: ftpquotalimitsRouter,
  ftpquotatallies: ftpquotatalliesRouter,
  ftpquotatallieshistory: ftpquotatallieshistoriesRouter,
  ftpuser: ftpusersRouter,
  loginhistory: loginhistoriesRouter,
  orders: ordersRouter,
  plans: plansRouter,
  roles: rolesRouter,
  userfiles: userfilesRouter,
  users: usersRouter,
  products: productsRouter,
  checkoutLogs: checkoutLogsRouter,
  dirDownloads: dirDownloadRouter,
  downloadHistory: downloadHistoryRouter,
  migration: migrationRouter,
});

export type AppRouter = typeof appRouter;
