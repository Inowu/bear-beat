import { z } from 'zod';
import { FtpUserSelectObjectSchema } from './objects/FtpUserSelect.schema';
import { FtpUserUpdateInputObjectSchema } from './objects/FtpUserUpdateInput.schema';
import { FtpUserUncheckedUpdateInputObjectSchema } from './objects/FtpUserUncheckedUpdateInput.schema';
import { FtpUserWhereUniqueInputObjectSchema } from './objects/FtpUserWhereUniqueInput.schema';

export const FtpUserUpdateOneSchema = z.object({
  select: FtpUserSelectObjectSchema.optional(),
  data: z.union([
    FtpUserUpdateInputObjectSchema,
    FtpUserUncheckedUpdateInputObjectSchema,
  ]),
  where: FtpUserWhereUniqueInputObjectSchema,
});
