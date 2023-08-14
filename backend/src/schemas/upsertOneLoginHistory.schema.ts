import { z } from 'zod';
import { LoginHistorySelectObjectSchema } from './objects/LoginHistorySelect.schema';
import { LoginHistoryWhereUniqueInputObjectSchema } from './objects/LoginHistoryWhereUniqueInput.schema';
import { LoginHistoryCreateInputObjectSchema } from './objects/LoginHistoryCreateInput.schema';
import { LoginHistoryUncheckedCreateInputObjectSchema } from './objects/LoginHistoryUncheckedCreateInput.schema';
import { LoginHistoryUpdateInputObjectSchema } from './objects/LoginHistoryUpdateInput.schema';
import { LoginHistoryUncheckedUpdateInputObjectSchema } from './objects/LoginHistoryUncheckedUpdateInput.schema';

export const LoginHistoryUpsertSchema = z.object({
  select: LoginHistorySelectObjectSchema.optional(),
  where: LoginHistoryWhereUniqueInputObjectSchema,
  create: z.union([
    LoginHistoryCreateInputObjectSchema,
    LoginHistoryUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    LoginHistoryUpdateInputObjectSchema,
    LoginHistoryUncheckedUpdateInputObjectSchema,
  ]),
});
