import { z } from 'zod';
import { LoginHistoryWhereUniqueInputObjectSchema } from './objects/LoginHistoryWhereUniqueInput.schema';

export const LoginHistoryDeleteOneSchema = z.object({
  where: LoginHistoryWhereUniqueInputObjectSchema,
});
