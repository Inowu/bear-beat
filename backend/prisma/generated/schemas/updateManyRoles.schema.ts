import { z } from 'zod';
import { RolesUpdateManyMutationInputObjectSchema } from './objects/RolesUpdateManyMutationInput.schema';
import { RolesWhereInputObjectSchema } from './objects/RolesWhereInput.schema';

export const RolesUpdateManySchema = z.object({
  data: RolesUpdateManyMutationInputObjectSchema,
  where: RolesWhereInputObjectSchema.optional(),
});
