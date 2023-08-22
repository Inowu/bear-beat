import { router } from '../../trpc';
import { subscribeWithCardConekta } from './subscribeWithCardConekta';
import { subscribeWithCashConekta } from './subscribeWithCashConekta';

export const subscriptionsRouter = router({
  subscribeWithCardConekta,
  subscribeWithCashConekta,
});
