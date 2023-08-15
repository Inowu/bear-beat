import { z } from 'zod';
import { LoginHistoryWhereUniqueInputObjectSchema } from './objects/LoginHistoryWhereUniqueInput.schema';

export const LoginHistoryFindUniqueSchema = z.object({
  where: LoginHistoryWhereUniqueInputObjectSchema,
});
