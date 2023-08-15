import { z } from 'zod';
import { LoginHistoryCreateInputObjectSchema } from './objects/LoginHistoryCreateInput.schema';
import { LoginHistoryUncheckedCreateInputObjectSchema } from './objects/LoginHistoryUncheckedCreateInput.schema';

export const LoginHistoryCreateOneSchema = z.object({
  data: z.union([
    LoginHistoryCreateInputObjectSchema,
    LoginHistoryUncheckedCreateInputObjectSchema,
  ]),
});
