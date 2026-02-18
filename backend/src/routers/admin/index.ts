import { router } from '../../trpc';
import { activatePlanForUser } from './producedures/activatePlanForUser';
import { adminWebhookInboxRouter } from './webhookInbox';

export const adminRouter = router({
  activatePlanForUser,
  webhookInbox: adminWebhookInboxRouter,
});
