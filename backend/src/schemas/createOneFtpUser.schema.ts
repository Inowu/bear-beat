import { z } from 'zod';
import { FtpUserSelectObjectSchema } from './objects/FtpUserSelect.schema';
import { FtpUserCreateInputObjectSchema } from './objects/FtpUserCreateInput.schema';
import { FtpUserUncheckedCreateInputObjectSchema } from './objects/FtpUserUncheckedCreateInput.schema';

export const FtpUserCreateOneSchema = z.object({
  select: FtpUserSelectObjectSchema.optional(),
  data: z.union([
    FtpUserCreateInputObjectSchema,
    FtpUserUncheckedCreateInputObjectSchema,
  ]),
});
