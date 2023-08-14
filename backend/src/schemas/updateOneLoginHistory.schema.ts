import { z } from 'zod';
import { LoginHistorySelectObjectSchema } from './objects/LoginHistorySelect.schema';
import { LoginHistoryUpdateInputObjectSchema } from './objects/LoginHistoryUpdateInput.schema';
import { LoginHistoryUncheckedUpdateInputObjectSchema } from './objects/LoginHistoryUncheckedUpdateInput.schema';
import { LoginHistoryWhereUniqueInputObjectSchema } from './objects/LoginHistoryWhereUniqueInput.schema';

export const LoginHistoryUpdateOneSchema = z.object({
  select: LoginHistorySelectObjectSchema.optional(),
  data: z.union([
    LoginHistoryUpdateInputObjectSchema,
    LoginHistoryUncheckedUpdateInputObjectSchema,
  ]),
  where: LoginHistoryWhereUniqueInputObjectSchema,
});
