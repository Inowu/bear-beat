import { z } from 'zod';
import { FtpUserUpdateInputObjectSchema } from './objects/FtpUserUpdateInput.schema';
import { FtpUserUncheckedUpdateInputObjectSchema } from './objects/FtpUserUncheckedUpdateInput.schema';
import { FtpUserWhereUniqueInputObjectSchema } from './objects/FtpUserWhereUniqueInput.schema';

export const FtpUserUpdateOneSchema = z.object({
  data: z.union([
    FtpUserUpdateInputObjectSchema,
    FtpUserUncheckedUpdateInputObjectSchema,
  ]),
  where: FtpUserWhereUniqueInputObjectSchema,
});
