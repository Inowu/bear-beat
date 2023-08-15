import { z } from 'zod';
import { RolesCreateInputObjectSchema } from './objects/RolesCreateInput.schema';
import { RolesUncheckedCreateInputObjectSchema } from './objects/RolesUncheckedCreateInput.schema';

export const RolesCreateOneSchema = z.object({
  data: z.union([
    RolesCreateInputObjectSchema,
    RolesUncheckedCreateInputObjectSchema,
  ]),
});
