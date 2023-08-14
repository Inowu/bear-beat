import { z } from 'zod';
import { UsersSelectObjectSchema } from './objects/UsersSelect.schema';
import { UsersIncludeObjectSchema } from './objects/UsersInclude.schema';
import { UsersWhereUniqueInputObjectSchema } from './objects/UsersWhereUniqueInput.schema';

export const UsersFindUniqueSchema = z.object({
  select: UsersSelectObjectSchema.optional(),
  include: UsersIncludeObjectSchema.optional(),
  where: UsersWhereUniqueInputObjectSchema,
});
