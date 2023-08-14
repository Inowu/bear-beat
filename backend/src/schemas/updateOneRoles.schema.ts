import { z } from 'zod';
import { RolesSelectObjectSchema } from './objects/RolesSelect.schema';
import { RolesIncludeObjectSchema } from './objects/RolesInclude.schema';
import { RolesUpdateInputObjectSchema } from './objects/RolesUpdateInput.schema';
import { RolesUncheckedUpdateInputObjectSchema } from './objects/RolesUncheckedUpdateInput.schema';
import { RolesWhereUniqueInputObjectSchema } from './objects/RolesWhereUniqueInput.schema';

export const RolesUpdateOneSchema = z.object({
  select: RolesSelectObjectSchema.optional(),
  include: RolesIncludeObjectSchema.optional(),
  data: z.union([
    RolesUpdateInputObjectSchema,
    RolesUncheckedUpdateInputObjectSchema,
  ]),
  where: RolesWhereUniqueInputObjectSchema,
});
