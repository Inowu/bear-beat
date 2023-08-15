import { z } from 'zod';
import { UsersUpdateManyMutationInputObjectSchema } from './objects/UsersUpdateManyMutationInput.schema';
import { UsersWhereInputObjectSchema } from './objects/UsersWhereInput.schema';

export const UsersUpdateManySchema = z.object({
  data: UsersUpdateManyMutationInputObjectSchema,
  where: UsersWhereInputObjectSchema.optional(),
});
