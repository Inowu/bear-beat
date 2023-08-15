import { z } from 'zod';
import { FtpquotatalliesWhereUniqueInputObjectSchema } from './objects/FtpquotatalliesWhereUniqueInput.schema';
import { FtpquotatalliesCreateInputObjectSchema } from './objects/FtpquotatalliesCreateInput.schema';
import { FtpquotatalliesUncheckedCreateInputObjectSchema } from './objects/FtpquotatalliesUncheckedCreateInput.schema';
import { FtpquotatalliesUpdateInputObjectSchema } from './objects/FtpquotatalliesUpdateInput.schema';
import { FtpquotatalliesUncheckedUpdateInputObjectSchema } from './objects/FtpquotatalliesUncheckedUpdateInput.schema';

export const FtpquotatalliesUpsertSchema = z.object({
  where: FtpquotatalliesWhereUniqueInputObjectSchema,
  create: z.union([
    FtpquotatalliesCreateInputObjectSchema,
    FtpquotatalliesUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    FtpquotatalliesUpdateInputObjectSchema,
    FtpquotatalliesUncheckedUpdateInputObjectSchema,
  ]),
});
