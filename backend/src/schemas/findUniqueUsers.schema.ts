import { z } from 'zod';
import { UsersSelectObjectSchema } from './objects/UsersSelect.schema';
import { UsersWhereUniqueInputObjectSchema } from './objects/UsersWhereUniqueInput.schema';

export const UsersFindUniqueSchema = z.object({
  select: UsersSelectObjectSchema.optional(),
  where: UsersWhereUniqueInputObjectSchema,
});
