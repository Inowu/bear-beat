import { z } from 'zod';
import { RolesSelectObjectSchema } from './objects/RolesSelect.schema';
import { RolesWhereUniqueInputObjectSchema } from './objects/RolesWhereUniqueInput.schema';

export const RolesFindUniqueSchema = z.object({
  select: RolesSelectObjectSchema.optional(),
  where: RolesWhereUniqueInputObjectSchema,
});
