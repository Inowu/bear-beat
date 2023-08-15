import { z } from 'zod';
import { UserFilesWhereUniqueInputObjectSchema } from './objects/UserFilesWhereUniqueInput.schema';

export const UserFilesDeleteOneSchema = z.object({
  where: UserFilesWhereUniqueInputObjectSchema,
});
