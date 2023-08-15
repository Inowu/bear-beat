import { z } from 'zod';
import { UserFilesWhereUniqueInputObjectSchema } from './objects/UserFilesWhereUniqueInput.schema';
import { UserFilesCreateInputObjectSchema } from './objects/UserFilesCreateInput.schema';
import { UserFilesUncheckedCreateInputObjectSchema } from './objects/UserFilesUncheckedCreateInput.schema';
import { UserFilesUpdateInputObjectSchema } from './objects/UserFilesUpdateInput.schema';
import { UserFilesUncheckedUpdateInputObjectSchema } from './objects/UserFilesUncheckedUpdateInput.schema';

export const UserFilesUpsertSchema = z.object({
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
