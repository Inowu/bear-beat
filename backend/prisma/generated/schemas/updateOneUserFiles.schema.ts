import { z } from 'zod';
import { UserFilesUpdateInputObjectSchema } from './objects/UserFilesUpdateInput.schema';
import { UserFilesUncheckedUpdateInputObjectSchema } from './objects/UserFilesUncheckedUpdateInput.schema';
import { UserFilesWhereUniqueInputObjectSchema } from './objects/UserFilesWhereUniqueInput.schema';

export const UserFilesUpdateOneSchema = z.object({
  data: z.union([
    UserFilesUpdateInputObjectSchema,
    UserFilesUncheckedUpdateInputObjectSchema,
  ]),
  where: UserFilesWhereUniqueInputObjectSchema,
});
