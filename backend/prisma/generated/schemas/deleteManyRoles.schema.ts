import { z } from 'zod';
import { RolesWhereInputObjectSchema } from './objects/RolesWhereInput.schema';

export const RolesDeleteManySchema = z.object({
  where: RolesWhereInputObjectSchema.optional(),
});
