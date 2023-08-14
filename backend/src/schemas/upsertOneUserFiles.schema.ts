import { z } from 'zod';
import { UserFilesSelectObjectSchema } from './objects/UserFilesSelect.schema';
import { UserFilesWhereUniqueInputObjectSchema } from './objects/UserFilesWhereUniqueInput.schema';
import { UserFilesCreateInputObjectSchema } from './objects/UserFilesCreateInput.schema';
import { UserFilesUncheckedCreateInputObjectSchema } from './objects/UserFilesUncheckedCreateInput.schema';
import { UserFilesUpdateInputObjectSchema } from './objects/UserFilesUpdateInput.schema';
import { UserFilesUncheckedUpdateInputObjectSchema } from './objects/UserFilesUncheckedUpdateInput.schema';

export const UserFilesUpsertSchema = z.object({
  select: UserFilesSelectObjectSchema.optional(),
  where: UserFilesWhereUniqueInputObjectSchema,
  create: z.union([
    UserFilesCreateInputObjectSchema,
    UserFilesUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    UserFilesUpdateInputObjectSchema,
    UserFilesUncheckedUpdateInputObjectSchema,
  ]),
});
