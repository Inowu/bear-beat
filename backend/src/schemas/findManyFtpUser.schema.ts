import { z } from 'zod';
import { FtpUserSelectObjectSchema } from './objects/FtpUserSelect.schema';
import { FtpUserOrderByWithRelationInputObjectSchema } from './objects/FtpUserOrderByWithRelationInput.schema';
import { FtpUserWhereInputObjectSchema } from './objects/FtpUserWhereInput.schema';
import { FtpUserWhereUniqueInputObjectSchema } from './objects/FtpUserWhereUniqueInput.schema';
import { FtpUserScalarFieldEnumSchema } from './enums/FtpUserScalarFieldEnum.schema';

export const FtpUserFindManySchema = z.object({
  select: z.lazy(() => FtpUserSelectObjectSchema.optional()),
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
