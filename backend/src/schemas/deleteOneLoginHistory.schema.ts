import { z } from 'zod';
import { LoginHistorySelectObjectSchema } from './objects/LoginHistorySelect.schema';
import { LoginHistoryWhereUniqueInputObjectSchema } from './objects/LoginHistoryWhereUniqueInput.schema';

export const LoginHistoryDeleteOneSchema = z.object({
  select: LoginHistorySelectObjectSchema.optional(),
  where: LoginHistoryWhereUniqueInputObjectSchema,
});
