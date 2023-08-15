import { z } from 'zod';
import { UsersWhereUniqueInputObjectSchema } from './objects/UsersWhereUniqueInput.schema';

export const UsersFindUniqueSchema = z.object({
  where: UsersWhereUniqueInputObjectSchema,
});
