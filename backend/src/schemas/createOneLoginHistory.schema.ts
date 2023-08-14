import { z } from 'zod';
import { LoginHistorySelectObjectSchema } from './objects/LoginHistorySelect.schema';
import { LoginHistoryCreateInputObjectSchema } from './objects/LoginHistoryCreateInput.schema';
import { LoginHistoryUncheckedCreateInputObjectSchema } from './objects/LoginHistoryUncheckedCreateInput.schema';

export const LoginHistoryCreateOneSchema = z.object({
  select: LoginHistorySelectObjectSchema.optional(),
  data: z.union([
    LoginHistoryCreateInputObjectSchema,
    LoginHistoryUncheckedCreateInputObjectSchema,
  ]),
});
