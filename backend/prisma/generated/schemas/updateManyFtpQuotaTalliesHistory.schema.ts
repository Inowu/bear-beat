import { z } from 'zod';
import { FtpQuotaTalliesHistoryUpdateManyMutationInputObjectSchema } from './objects/FtpQuotaTalliesHistoryUpdateManyMutationInput.schema';
import { FtpQuotaTalliesHistoryWhereInputObjectSchema } from './objects/FtpQuotaTalliesHistoryWhereInput.schema';

export const FtpQuotaTalliesHistoryUpdateManySchema = z.object({
  data: FtpQuotaTalliesHistoryUpdateManyMutationInputObjectSchema,
  where: FtpQuotaTalliesHistoryWhereInputObjectSchema.optional(),
});
