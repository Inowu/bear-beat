import { z } from 'zod';
import { UsersWhereUniqueInputObjectSchema } from './objects/UsersWhereUniqueInput.schema';
import { UsersCreateInputObjectSchema } from './objects/UsersCreateInput.schema';
import { UsersUncheckedCreateInputObjectSchema } from './objects/UsersUncheckedCreateInput.schema';
import { UsersUpdateInputObjectSchema } from './objects/UsersUpdateInput.schema';
import { UsersUncheckedUpdateInputObjectSchema } from './objects/UsersUncheckedUpdateInput.schema';

export const UsersUpsertSchema = z.object({
  where: UsersWhereUniqueInputObjectSchema,
  create: z.union([
    UsersCreateInputObjectSchema,
    UsersUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    UsersUpdateInputObjectSchema,
    UsersUncheckedUpdateInputObjectSchema,
  ]),
});
