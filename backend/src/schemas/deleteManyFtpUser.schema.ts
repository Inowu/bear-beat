import { z } from 'zod';
import { FtpUserWhereInputObjectSchema } from './objects/FtpUserWhereInput.schema';

export const FtpUserDeleteManySchema = z.object({
  where: FtpUserWhereInputObjectSchema.optional(),
});
