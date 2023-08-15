import { z } from 'zod';
import { UsersCreateInputObjectSchema } from './objects/UsersCreateInput.schema';
import { UsersUncheckedCreateInputObjectSchema } from './objects/UsersUncheckedCreateInput.schema';

export const UsersCreateOneSchema = z.object({
  data: z.union([
    UsersCreateInputObjectSchema,
    UsersUncheckedCreateInputObjectSchema,
  ]),
});
