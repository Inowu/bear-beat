import { z } from 'zod';
import { UserFilesWhereInputObjectSchema } from './objects/UserFilesWhereInput.schema';

export const UserFilesDeleteManySchema = z.object({
  where: UserFilesWhereInputObjectSchema.optional(),
});
