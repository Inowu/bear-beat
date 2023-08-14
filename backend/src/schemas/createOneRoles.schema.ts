import { z } from 'zod';
import { RolesSelectObjectSchema } from './objects/RolesSelect.schema';
import { RolesIncludeObjectSchema } from './objects/RolesInclude.schema';
import { RolesCreateInputObjectSchema } from './objects/RolesCreateInput.schema';
import { RolesUncheckedCreateInputObjectSchema } from './objects/RolesUncheckedCreateInput.schema';

export const RolesCreateOneSchema = z.object({
  select: RolesSelectObjectSchema.optional(),
  include: RolesIncludeObjectSchema.optional(),
  data: z.union([
    RolesCreateInputObjectSchema,
    RolesUncheckedCreateInputObjectSchema,
  ]),
});
