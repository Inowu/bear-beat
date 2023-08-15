import { z } from 'zod';
import { FtpUserOrderByWithRelationInputObjectSchema } from './objects/FtpUserOrderByWithRelationInput.schema';
import { FtpUserWhereInputObjectSchema } from './objects/FtpUserWhereInput.schema';
import { FtpUserWhereUniqueInputObjectSchema } from './objects/FtpUserWhereUniqueInput.schema';
import { FtpUserScalarFieldEnumSchema } from './enums/FtpUserScalarFieldEnum.schema';

export const FtpUserFindManySchema = z.object({
  orderBy: z
    .union([
      FtpUserOrderByWithRelationInputObjectSchema,
      FtpUserOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: FtpUserWhereInputObjectSchema.optional(),
  cursor: FtpUserWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.array(FtpUserScalarFieldEnumSchema).optional(),
});
