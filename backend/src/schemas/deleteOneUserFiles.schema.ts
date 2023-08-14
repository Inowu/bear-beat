import { z } from 'zod';
import { UserFilesSelectObjectSchema } from './objects/UserFilesSelect.schema';
import { UserFilesWhereUniqueInputObjectSchema } from './objects/UserFilesWhereUniqueInput.schema';

export const UserFilesDeleteOneSchema = z.object({
  select: UserFilesSelectObjectSchema.optional(),
  where: UserFilesWhereUniqueInputObjectSchema,
});
