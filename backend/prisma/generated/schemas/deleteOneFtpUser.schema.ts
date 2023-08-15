import { z } from 'zod';
import { FtpUserWhereUniqueInputObjectSchema } from './objects/FtpUserWhereUniqueInput.schema';

export const FtpUserDeleteOneSchema = z.object({
  where: FtpUserWhereUniqueInputObjectSchema,
});
