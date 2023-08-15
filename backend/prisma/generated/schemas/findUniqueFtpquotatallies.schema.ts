import { z } from 'zod';
import { FtpquotatalliesWhereUniqueInputObjectSchema } from './objects/FtpquotatalliesWhereUniqueInput.schema';

export const FtpquotatalliesFindUniqueSchema = z.object({
  where: FtpquotatalliesWhereUniqueInputObjectSchema,
});
