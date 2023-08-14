import { z } from 'zod';
import { UserFilesCreateManyInputObjectSchema } from './objects/UserFilesCreateManyInput.schema';

export const UserFilesCreateManySchema = z.object({
  data: z.union([
    UserFilesCreateManyInputObjectSchema,
    z.array(UserFilesCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
