import { z } from 'zod';
import { UsersSelectObjectSchema } from './objects/UsersSelect.schema';
import { UsersIncludeObjectSchema } from './objects/UsersInclude.schema';
import { UsersOrderByWithRelationInputObjectSchema } from './objects/UsersOrderByWithRelationInput.schema';
import { UsersWhereInputObjectSchema } from './objects/UsersWhereInput.schema';
import { UsersWhereUniqueInputObjectSchema } from './objects/UsersWhereUniqueInput.schema';
import { UsersScalarFieldEnumSchema } from './enums/UsersScalarFieldEnum.schema';

export const UsersFindManySchema = z.object({
  select: z.lazy(() => UsersSelectObjectSchema.optional()),
  include: z.lazy(() => UsersIncludeObjectSchema.optional()),
  orderBy: z
    .union([
      UsersOrderByWithRelationInputObjectSchema,
      UsersOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: UsersWhereInputObjectSchema.optional(),
  cursor: UsersWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.array(UsersScalarFieldEnumSchema).optional(),
});
