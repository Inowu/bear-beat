import { z } from 'zod';
import { UserFilesCreateInputObjectSchema } from './objects/UserFilesCreateInput.schema';
import { UserFilesUncheckedCreateInputObjectSchema } from './objects/UserFilesUncheckedCreateInput.schema';

export const UserFilesCreateOneSchema = z.object({
  data: z.union([
    UserFilesCreateInputObjectSchema,
    UserFilesUncheckedCreateInputObjectSchema,
  ]),
});
