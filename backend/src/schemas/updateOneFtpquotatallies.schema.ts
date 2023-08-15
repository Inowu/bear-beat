import { z } from 'zod';
import { FtpquotatalliesUpdateInputObjectSchema } from './objects/FtpquotatalliesUpdateInput.schema';
import { FtpquotatalliesUncheckedUpdateInputObjectSchema } from './objects/FtpquotatalliesUncheckedUpdateInput.schema';
import { FtpquotatalliesWhereUniqueInputObjectSchema } from './objects/FtpquotatalliesWhereUniqueInput.schema';

export const FtpquotatalliesUpdateOneSchema = z.object({
  data: z.union([
    FtpquotatalliesUpdateInputObjectSchema,
    FtpquotatalliesUncheckedUpdateInputObjectSchema,
  ]),
  where: FtpquotatalliesWhereUniqueInputObjectSchema,
});
