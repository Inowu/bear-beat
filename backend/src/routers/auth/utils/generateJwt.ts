import jwt from 'jsonwebtoken';
import { Users } from '@prisma/client';
import { serializeUser } from './serialize-user';

export const generateJwt = (user: Users) =>
  jwt.sign(serializeUser(user), process.env.JWT_SECRET as string, {
    expiresIn: '7d',
  });
