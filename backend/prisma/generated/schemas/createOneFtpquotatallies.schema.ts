import { z } from 'zod';
import { FtpquotatalliesCreateInputObjectSchema } from './objects/FtpquotatalliesCreateInput.schema';
import { FtpquotatalliesUncheckedCreateInputObjectSchema } from './objects/FtpquotatalliesUncheckedCreateInput.schema';

export const FtpquotatalliesCreateOneSchema = z.object({
  data: z.union([
    FtpquotatalliesCreateInputObjectSchema,
    FtpquotatalliesUncheckedCreateInputObjectSchema,
  ]),
});
