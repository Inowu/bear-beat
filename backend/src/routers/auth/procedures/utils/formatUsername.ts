import crypto from 'crypto';
import { Users } from '@prisma/client';

export const stripNonAlphabetic = (user: Users) => {
  let name = user.username.replace(/[^a-zA-Z]/g, '');

  if (!name) {
    name = user.email.split('@')[0].replace(/[^a-zA-Z]/g, '');
  }

  if (!name) {
    name = crypto.randomBytes(6).toString('hex');
  }

  return name;
};
