import { z } from 'zod';
import { UsersOrderByWithRelationInputObjectSchema } from './objects/UsersOrderByWithRelationInput.schema';
import { UsersWhereInputObjectSchema } from './objects/UsersWhereInput.schema';
import { UsersWhereUniqueInputObjectSchema } from './objects/UsersWhereUniqueInput.schema';
import { UsersScalarFieldEnumSchema } from './enums/UsersScalarFieldEnum.schema';

export const UsersFindFirstSchema = z.object({
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
