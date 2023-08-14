import { z } from 'zod';
import { UserFilesSelectObjectSchema } from './objects/UserFilesSelect.schema';
import { UserFilesUpdateInputObjectSchema } from './objects/UserFilesUpdateInput.schema';
import { UserFilesUncheckedUpdateInputObjectSchema } from './objects/UserFilesUncheckedUpdateInput.schema';
import { UserFilesWhereUniqueInputObjectSchema } from './objects/UserFilesWhereUniqueInput.schema';

export const UserFilesUpdateOneSchema = z.object({
  select: UserFilesSelectObjectSchema.optional(),
  data: z.union([
    UserFilesUpdateInputObjectSchema,
    UserFilesUncheckedUpdateInputObjectSchema,
  ]),
  where: UserFilesWhereUniqueInputObjectSchema,
});
