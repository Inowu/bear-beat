import { z } from 'zod';
import { FtpUserSelectObjectSchema } from './objects/FtpUserSelect.schema';
import { FtpUserWhereUniqueInputObjectSchema } from './objects/FtpUserWhereUniqueInput.schema';

export const FtpUserDeleteOneSchema = z.object({
  select: FtpUserSelectObjectSchema.optional(),
  where: FtpUserWhereUniqueInputObjectSchema,
});
