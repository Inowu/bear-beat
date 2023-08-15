import { z } from 'zod';
import { FtpUserWhereUniqueInputObjectSchema } from './objects/FtpUserWhereUniqueInput.schema';

export const FtpUserFindUniqueSchema = z.object({
  where: FtpUserWhereUniqueInputObjectSchema,
});
