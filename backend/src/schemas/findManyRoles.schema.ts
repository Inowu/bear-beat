import { z } from 'zod';
import { RolesSelectObjectSchema } from './objects/RolesSelect.schema';
import { RolesIncludeObjectSchema } from './objects/RolesInclude.schema';
import { RolesOrderByWithRelationInputObjectSchema } from './objects/RolesOrderByWithRelationInput.schema';
import { RolesWhereInputObjectSchema } from './objects/RolesWhereInput.schema';
import { RolesWhereUniqueInputObjectSchema } from './objects/RolesWhereUniqueInput.schema';
import { RolesScalarFieldEnumSchema } from './enums/RolesScalarFieldEnum.schema';

export const RolesFindManySchema = z.object({
  select: z.lazy(() => RolesSelectObjectSchema.optional()),
  include: z.lazy(() => RolesIncludeObjectSchema.optional()),
  orderBy: z
    .union([
      RolesOrderByWithRelationInputObjectSchema,
      RolesOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: RolesWhereInputObjectSchema.optional(),
  cursor: RolesWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.array(RolesScalarFieldEnumSchema).optional(),
});
