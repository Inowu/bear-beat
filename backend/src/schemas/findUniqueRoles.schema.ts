import { z } from 'zod';
import { RolesSelectObjectSchema } from './objects/RolesSelect.schema';
import { RolesIncludeObjectSchema } from './objects/RolesInclude.schema';
import { RolesWhereUniqueInputObjectSchema } from './objects/RolesWhereUniqueInput.schema';

export const RolesFindUniqueSchema = z.object({
  select: RolesSelectObjectSchema.optional(),
  include: RolesIncludeObjectSchema.optional(),
  where: RolesWhereUniqueInputObjectSchema,
});
