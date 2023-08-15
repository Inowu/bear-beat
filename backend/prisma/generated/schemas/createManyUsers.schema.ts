import { z } from 'zod';
import { UsersCreateManyInputObjectSchema } from './objects/UsersCreateManyInput.schema';

export const UsersCreateManySchema = z.object({
  data: z.union([
    UsersCreateManyInputObjectSchema,
    z.array(UsersCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
