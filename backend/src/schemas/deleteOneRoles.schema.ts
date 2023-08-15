import { z } from 'zod';
import { RolesSelectObjectSchema } from './objects/RolesSelect.schema';
import { RolesWhereUniqueInputObjectSchema } from './objects/RolesWhereUniqueInput.schema';

export const RolesDeleteOneSchema = z.object({
  select: RolesSelectObjectSchema.optional(),
  where: RolesWhereUniqueInputObjectSchema,
});
