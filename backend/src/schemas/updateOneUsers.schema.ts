import { z } from 'zod';
import { UsersSelectObjectSchema } from './objects/UsersSelect.schema';
import { UsersUpdateInputObjectSchema } from './objects/UsersUpdateInput.schema';
import { UsersWhereUniqueInputObjectSchema } from './objects/UsersWhereUniqueInput.schema';

export const UsersUpdateOneSchema = z.object({
  select: UsersSelectObjectSchema.optional(),
  data: UsersUpdateInputObjectSchema,
  where: UsersWhereUniqueInputObjectSchema,
});
