import { z } from 'zod';
import { UserFilesSelectObjectSchema } from './objects/UserFilesSelect.schema';
import { UserFilesCreateInputObjectSchema } from './objects/UserFilesCreateInput.schema';
import { UserFilesUncheckedCreateInputObjectSchema } from './objects/UserFilesUncheckedCreateInput.schema';

export const UserFilesCreateOneSchema = z.object({
  select: UserFilesSelectObjectSchema.optional(),
  data: z.union([
    UserFilesCreateInputObjectSchema,
    UserFilesUncheckedCreateInputObjectSchema,
  ]),
});
