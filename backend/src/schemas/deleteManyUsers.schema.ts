import { z } from 'zod';
import { UsersWhereInputObjectSchema } from './objects/UsersWhereInput.schema';

export const UsersDeleteManySchema = z.object({
  where: UsersWhereInputObjectSchema.optional(),
});
