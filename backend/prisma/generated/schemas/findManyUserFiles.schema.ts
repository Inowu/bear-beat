import { z } from 'zod';
import { UserFilesOrderByWithRelationInputObjectSchema } from './objects/UserFilesOrderByWithRelationInput.schema';
import { UserFilesWhereInputObjectSchema } from './objects/UserFilesWhereInput.schema';
import { UserFilesWhereUniqueInputObjectSchema } from './objects/UserFilesWhereUniqueInput.schema';
import { UserFilesScalarFieldEnumSchema } from './enums/UserFilesScalarFieldEnum.schema';

export const UserFilesFindManySchema = z.object({
  orderBy: z
    .union([
      UserFilesOrderByWithRelationInputObjectSchema,
      UserFilesOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: UserFilesWhereInputObjectSchema.optional(),
  cursor: UserFilesWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.array(UserFilesScalarFieldEnumSchema).optional(),
});
