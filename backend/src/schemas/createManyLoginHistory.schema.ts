import { z } from 'zod';
import { LoginHistoryCreateManyInputObjectSchema } from './objects/LoginHistoryCreateManyInput.schema';

export const LoginHistoryCreateManySchema = z.object({
  data: z.union([
    LoginHistoryCreateManyInputObjectSchema,
    z.array(LoginHistoryCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
