import { z } from 'zod';
import { LoginHistoryUpdateInputObjectSchema } from './objects/LoginHistoryUpdateInput.schema';
import { LoginHistoryUncheckedUpdateInputObjectSchema } from './objects/LoginHistoryUncheckedUpdateInput.schema';
import { LoginHistoryWhereUniqueInputObjectSchema } from './objects/LoginHistoryWhereUniqueInput.schema';

export const LoginHistoryUpdateOneSchema = z.object({
  data: z.union([
    LoginHistoryUpdateInputObjectSchema,
    LoginHistoryUncheckedUpdateInputObjectSchema,
  ]),
  where: LoginHistoryWhereUniqueInputObjectSchema,
});
