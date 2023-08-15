import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcrypt';
import { publicProcedure } from '../../procedures/public.procedure';
import { generateJwt } from './utils/generateJwt';

export const login = publicProcedure
  .input(
    z.object({
      username: z.string(),
      password: z.string(),
    }),
  )
  .query(async ({ input: { password, username }, ctx: { prisma } }) => {
    console.log(password, username);
    const user = await prisma.users.findFirst({
      where: {
        OR: [
          {
            username,
          },
          {
            email: username,
          },
        ],
      },
    });

    console.log(user);
    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    console.log('Original hash', user.password);
    const hash = user.password.replace('$2y$', '$2b$');
    console.log('New hash', hash);

    const isPasswordCorrect = bcrypt.compareSync(password, hash);

    if (!isPasswordCorrect) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    return {
      token: generateJwt(user),
    };
  });
