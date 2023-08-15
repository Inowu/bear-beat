import { z } from 'zod';
import { UsersWhereUniqueInputObjectSchema } from './objects/UsersWhereUniqueInput.schema';

export const UsersDeleteOneSchema = z.object({
  where: UsersWhereUniqueInputObjectSchema,
});
