import { router } from '../../trpc';
import { checkUHSubscriber } from './checkUHSubscriber';

export const migrationRouter = router({
  checkUHSubscriber,
});
