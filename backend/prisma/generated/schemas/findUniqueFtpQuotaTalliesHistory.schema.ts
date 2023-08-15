import { z } from 'zod';
import { FtpQuotaTalliesHistoryWhereUniqueInputObjectSchema } from './objects/FtpQuotaTalliesHistoryWhereUniqueInput.schema';

export const FtpQuotaTalliesHistoryFindUniqueSchema = z.object({
  where: FtpQuotaTalliesHistoryWhereUniqueInputObjectSchema,
});
