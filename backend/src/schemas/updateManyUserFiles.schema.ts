import { z } from 'zod';
import { UserFilesUpdateManyMutationInputObjectSchema } from './objects/UserFilesUpdateManyMutationInput.schema';
import { UserFilesWhereInputObjectSchema } from './objects/UserFilesWhereInput.schema';

export const UserFilesUpdateManySchema = z.object({
  data: UserFilesUpdateManyMutationInputObjectSchema,
  where: UserFilesWhereInputObjectSchema.optional(),
});
