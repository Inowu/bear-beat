import { z } from 'zod';
import { FtpQuotatAlliesHistoryCreateManyInputObjectSchema } from './objects/FtpQuotatAlliesHistoryCreateManyInput.schema';

export const FtpQuotatAlliesHistoryCreateManySchema = z.object({
  data: z.union([
    FtpQuotatAlliesHistoryCreateManyInputObjectSchema,
    z.array(FtpQuotatAlliesHistoryCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
