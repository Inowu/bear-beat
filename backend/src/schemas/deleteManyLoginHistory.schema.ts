import { z } from 'zod';
import { LoginHistoryWhereInputObjectSchema } from './objects/LoginHistoryWhereInput.schema';

export const LoginHistoryDeleteManySchema = z.object({
  where: LoginHistoryWhereInputObjectSchema.optional(),
});
