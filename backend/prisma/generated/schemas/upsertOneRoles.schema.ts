import { z } from 'zod';
import { RolesWhereUniqueInputObjectSchema } from './objects/RolesWhereUniqueInput.schema';
import { RolesCreateInputObjectSchema } from './objects/RolesCreateInput.schema';
import { RolesUncheckedCreateInputObjectSchema } from './objects/RolesUncheckedCreateInput.schema';
import { RolesUpdateInputObjectSchema } from './objects/RolesUpdateInput.schema';
import { RolesUncheckedUpdateInputObjectSchema } from './objects/RolesUncheckedUpdateInput.schema';

export const RolesUpsertSchema = z.object({
  where: RolesWhereUniqueInputObjectSchema,
  create: z.union([
    RolesCreateInputObjectSchema,
    RolesUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    RolesUpdateInputObjectSchema,
    RolesUncheckedUpdateInputObjectSchema,
  ]),
});
