import { router } from '../../trpc';
import { changePassword } from './procedures/changePassword';
import { forgotPassword } from './procedures/forgotPasword';
import { login } from './procedures/login';
import { me } from './procedures/me';
import { refresh } from './procedures/refresh';
import { register } from './procedures/register';

export const authRouter = router({
  login,
  me,
  register,
  changePassword,
  forgotPassword,
  refresh,
});
