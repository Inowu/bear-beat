import { z } from 'zod';
import { UserFilesWhereUniqueInputObjectSchema } from './objects/UserFilesWhereUniqueInput.schema';

export const UserFilesFindUniqueSchema = z.object({
  where: UserFilesWhereUniqueInputObjectSchema,
});
