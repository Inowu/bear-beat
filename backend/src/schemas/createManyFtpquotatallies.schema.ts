import { z } from 'zod';
import { FtpquotatalliesCreateManyInputObjectSchema } from './objects/FtpquotatalliesCreateManyInput.schema';

export const FtpquotatalliesCreateManySchema = z.object({
  data: z.union([
    FtpquotatalliesCreateManyInputObjectSchema,
    z.array(FtpquotatalliesCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
