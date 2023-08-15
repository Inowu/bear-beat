import { z } from 'zod';
import { FtpUserCreateManyInputObjectSchema } from './objects/FtpUserCreateManyInput.schema';

export const FtpUserCreateManySchema = z.object({
  data: z.union([
    FtpUserCreateManyInputObjectSchema,
    z.array(FtpUserCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
