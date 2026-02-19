import { router } from '../../trpc';
import { activatePlanForUser } from './producedures/activatePlanForUser';
import { activatePlanFromPaymentReference } from './producedures/activatePlanFromPaymentReference';
import { adminWebhookInboxRouter } from './webhookInbox';
import { adminEmailTemplatesRouter } from './emailTemplates';

export const adminRouter = router({
  activatePlanForUser,
  activatePlanFromPaymentReference,
  webhookInbox: adminWebhookInboxRouter,
  emailTemplates: adminEmailTemplatesRouter,
});
