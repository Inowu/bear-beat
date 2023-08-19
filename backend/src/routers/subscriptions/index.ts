import { router } from '../../trpc';
import { subscribeWithCardConekta } from './subscribeWithCardConekta';
import { subscribeWithOxxoConekta } from './subscribeWithOxxoConekta';

export const subscriptionsRouter = router({
  subscribeWithCardConekta,
  subscribeWithOxxoConekta,
});
