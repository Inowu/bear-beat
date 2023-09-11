import { router } from '../../trpc';
import { activatePlanForUser } from './producedures/activatePlanForUser';

export const adminRouter = router({
  activatePlanForUser,
});
