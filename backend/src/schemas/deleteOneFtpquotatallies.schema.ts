import { z } from 'zod';
import { FtpquotatalliesWhereUniqueInputObjectSchema } from './objects/FtpquotatalliesWhereUniqueInput.schema';

export const FtpquotatalliesDeleteOneSchema = z.object({
  where: FtpquotatalliesWhereUniqueInputObjectSchema,
});
