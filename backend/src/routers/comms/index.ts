import { router } from '../../trpc';
import { getEmailPreferences } from './getEmailPreferences';
import { updateEmailPreferences } from './updateEmailPreferences';

export const commsRouter = router({
  getEmailPreferences,
  updateEmailPreferences,
});

