import { z } from 'zod';
import { FtpquotatalliesOrderByWithRelationInputObjectSchema } from './objects/FtpquotatalliesOrderByWithRelationInput.schema';
import { FtpquotatalliesWhereInputObjectSchema } from './objects/FtpquotatalliesWhereInput.schema';
import { FtpquotatalliesWhereUniqueInputObjectSchema } from './objects/FtpquotatalliesWhereUniqueInput.schema';
import { FtpquotatalliesScalarFieldEnumSchema } from './enums/FtpquotatalliesScalarFieldEnum.schema';

export const FtpquotatalliesFindFirstSchema = z.object({
  orderBy: z
    .union([
      FtpquotatalliesOrderByWithRelationInputObjectSchema,
      FtpquotatalliesOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: FtpquotatalliesWhereInputObjectSchema.optional(),
  cursor: FtpquotatalliesWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.array(FtpquotatalliesScalarFieldEnumSchema).optional(),
});
