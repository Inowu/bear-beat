import { z } from 'zod';
import { LoginHistoryOrderByWithRelationInputObjectSchema } from './objects/LoginHistoryOrderByWithRelationInput.schema';
import { LoginHistoryWhereInputObjectSchema } from './objects/LoginHistoryWhereInput.schema';
import { LoginHistoryWhereUniqueInputObjectSchema } from './objects/LoginHistoryWhereUniqueInput.schema';
import { LoginHistoryScalarFieldEnumSchema } from './enums/LoginHistoryScalarFieldEnum.schema';

export const LoginHistoryFindFirstSchema = z.object({
  orderBy: z
    .union([
      LoginHistoryOrderByWithRelationInputObjectSchema,
      LoginHistoryOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: LoginHistoryWhereInputObjectSchema.optional(),
  cursor: LoginHistoryWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.array(LoginHistoryScalarFieldEnumSchema).optional(),
});
