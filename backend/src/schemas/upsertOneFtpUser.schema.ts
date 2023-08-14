import { z } from 'zod';
import { FtpUserSelectObjectSchema } from './objects/FtpUserSelect.schema';
import { FtpUserWhereUniqueInputObjectSchema } from './objects/FtpUserWhereUniqueInput.schema';
import { FtpUserCreateInputObjectSchema } from './objects/FtpUserCreateInput.schema';
import { FtpUserUncheckedCreateInputObjectSchema } from './objects/FtpUserUncheckedCreateInput.schema';
import { FtpUserUpdateInputObjectSchema } from './objects/FtpUserUpdateInput.schema';
import { FtpUserUncheckedUpdateInputObjectSchema } from './objects/FtpUserUncheckedUpdateInput.schema';

export const FtpUserUpsertSchema = z.object({
  select: FtpUserSelectObjectSchema.optional(),
  where: FtpUserWhereUniqueInputObjectSchema,
  create: z.union([
    FtpUserCreateInputObjectSchema,
    FtpUserUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    FtpUserUpdateInputObjectSchema,
    FtpUserUncheckedUpdateInputObjectSchema,
  ]),
});
