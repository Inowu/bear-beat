import { z } from 'zod';
import { UsersSelectObjectSchema } from './objects/UsersSelect.schema';
import { UsersWhereUniqueInputObjectSchema } from './objects/UsersWhereUniqueInput.schema';
import { UsersCreateInputObjectSchema } from './objects/UsersCreateInput.schema';
import { UsersUpdateInputObjectSchema } from './objects/UsersUpdateInput.schema';

export const UsersUpsertSchema = z.object({
  select: UsersSelectObjectSchema.optional(),
  where: UsersWhereUniqueInputObjectSchema,
  create: UsersCreateInputObjectSchema,
  update: UsersUpdateInputObjectSchema,
});
