import { router } from '../../trpc';
import { changePassword } from './procedures/changePassword';
import { forgotPassword } from './procedures/forgotPasword';
import { getCurrentSubscriptionPlan } from './procedures/getCurrentSubscriptionPlan';
import { impersonateUser } from './procedures/impersonateUser';
import { claimManyChatHandoff } from './procedures/claimManyChatHandoff';
import { login } from './procedures/login';
import { me } from './procedures/me';
import { refresh } from './procedures/refresh';
import { register } from './procedures/register';
import { verifyPhone } from './procedures/verifyPhone';
import { sendVerificationCode } from './procedures/sendVerificationCode';

export const authRouter = router({
  login,
  me,
  register,
  claimManyChatHandoff,
  changePassword,
  forgotPassword,
  refresh,
  verifyPhone,
  sendVerificationCode,
  getCurrentSubscriptionPlan,
  impersonateUser,
});
