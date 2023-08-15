import { z } from 'zod';
import { FtpUserCreateInputObjectSchema } from './objects/FtpUserCreateInput.schema';
import { FtpUserUncheckedCreateInputObjectSchema } from './objects/FtpUserUncheckedCreateInput.schema';

export const FtpUserCreateOneSchema = z.object({
  data: z.union([
    FtpUserCreateInputObjectSchema,
    FtpUserUncheckedCreateInputObjectSchema,
  ]),
});
