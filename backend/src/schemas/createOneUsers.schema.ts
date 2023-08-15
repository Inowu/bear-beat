import { z } from 'zod';
import { UsersSelectObjectSchema } from './objects/UsersSelect.schema';
import { UsersCreateInputObjectSchema } from './objects/UsersCreateInput.schema';

export const UsersCreateOneSchema = z.object({
  select: UsersSelectObjectSchema.optional(),
  data: UsersCreateInputObjectSchema,
});
