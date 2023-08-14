import { router } from '../../trpc';
import { login } from './login';
import { register } from './register';

export const authRouter = router({
  login,
  register,
});
