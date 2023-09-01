import { router } from '../../trpc';
import { login } from './procedures/login';
import { me } from './procedures/me';
import { register } from './procedures/register';

export const authRouter = router({
  login,
  me,
  register,
});
