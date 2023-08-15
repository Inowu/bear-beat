import { z } from 'zod';
import { FtpQuotaTalliesHistoryCreateManyInputObjectSchema } from './objects/FtpQuotaTalliesHistoryCreateManyInput.schema';

export const FtpQuotaTalliesHistoryCreateManySchema = z.object({
  data: z.union([
    FtpQuotaTalliesHistoryCreateManyInputObjectSchema,
    z.array(FtpQuotaTalliesHistoryCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
