import { z } from 'zod';
import { UsersUpdateInputObjectSchema } from './objects/UsersUpdateInput.schema';
import { UsersUncheckedUpdateInputObjectSchema } from './objects/UsersUncheckedUpdateInput.schema';
import { UsersWhereUniqueInputObjectSchema } from './objects/UsersWhereUniqueInput.schema';

export const UsersUpdateOneSchema = z.object({
  data: z.union([
    UsersUpdateInputObjectSchema,
    UsersUncheckedUpdateInputObjectSchema,
  ]),
  where: UsersWhereUniqueInputObjectSchema,
});
