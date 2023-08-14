import { z } from 'zod';
import { FtpUserUpdateManyMutationInputObjectSchema } from './objects/FtpUserUpdateManyMutationInput.schema';
import { FtpUserWhereInputObjectSchema } from './objects/FtpUserWhereInput.schema';

export const FtpUserUpdateManySchema = z.object({
  data: FtpUserUpdateManyMutationInputObjectSchema,
  where: FtpUserWhereInputObjectSchema.optional(),
});
