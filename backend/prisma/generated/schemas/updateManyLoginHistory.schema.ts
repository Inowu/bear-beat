import { z } from 'zod';
import { LoginHistoryUpdateManyMutationInputObjectSchema } from './objects/LoginHistoryUpdateManyMutationInput.schema';
import { LoginHistoryWhereInputObjectSchema } from './objects/LoginHistoryWhereInput.schema';

export const LoginHistoryUpdateManySchema = z.object({
  data: LoginHistoryUpdateManyMutationInputObjectSchema,
  where: LoginHistoryWhereInputObjectSchema.optional(),
});
