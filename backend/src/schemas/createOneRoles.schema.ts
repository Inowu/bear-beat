import { z } from 'zod';
import { RolesSelectObjectSchema } from './objects/RolesSelect.schema';
import { RolesCreateInputObjectSchema } from './objects/RolesCreateInput.schema';
import { RolesUncheckedCreateInputObjectSchema } from './objects/RolesUncheckedCreateInput.schema';

export const RolesCreateOneSchema = z.object({
  select: RolesSelectObjectSchema.optional(),
  data: z.union([
    RolesCreateInputObjectSchema,
    RolesUncheckedCreateInputObjectSchema,
  ]),
});
