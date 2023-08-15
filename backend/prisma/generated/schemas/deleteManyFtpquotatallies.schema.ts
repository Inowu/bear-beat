import { z } from 'zod';
import { FtpquotatalliesWhereInputObjectSchema } from './objects/FtpquotatalliesWhereInput.schema';

export const FtpquotatalliesDeleteManySchema = z.object({
  where: FtpquotatalliesWhereInputObjectSchema.optional(),
});
