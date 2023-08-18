import { router } from '../../trpc';
import { subscribeWithCardConekta } from './subscribeWithCardConekta';

export const subscriptionsRouter = router({
  subscribeWithCardConekta,
});
