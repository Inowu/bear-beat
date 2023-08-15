import { z } from 'zod';
import { RolesUpdateInputObjectSchema } from './objects/RolesUpdateInput.schema';
import { RolesUncheckedUpdateInputObjectSchema } from './objects/RolesUncheckedUpdateInput.schema';
import { RolesWhereUniqueInputObjectSchema } from './objects/RolesWhereUniqueInput.schema';

export const RolesUpdateOneSchema = z.object({
  data: z.union([
    RolesUpdateInputObjectSchema,
    RolesUncheckedUpdateInputObjectSchema,
  ]),
  where: RolesWhereUniqueInputObjectSchema,
});
