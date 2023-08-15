import { z } from 'zod';
import { FtpquotatalliesUpdateManyMutationInputObjectSchema } from './objects/FtpquotatalliesUpdateManyMutationInput.schema';
import { FtpquotatalliesWhereInputObjectSchema } from './objects/FtpquotatalliesWhereInput.schema';

export const FtpquotatalliesUpdateManySchema = z.object({
  data: FtpquotatalliesUpdateManyMutationInputObjectSchema,
  where: FtpquotatalliesWhereInputObjectSchema.optional(),
});
