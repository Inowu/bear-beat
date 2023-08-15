import { z } from 'zod';
import { DescargasUserWhereUniqueInputObjectSchema } from './objects/DescargasUserWhereUniqueInput.schema';
import { DescargasUserCreateInputObjectSchema } from './objects/DescargasUserCreateInput.schema';
import { DescargasUserUncheckedCreateInputObjectSchema } from './objects/DescargasUserUncheckedCreateInput.schema';
import { DescargasUserUpdateInputObjectSchema } from './objects/DescargasUserUpdateInput.schema';
import { DescargasUserUncheckedUpdateInputObjectSchema } from './objects/DescargasUserUncheckedUpdateInput.schema';

export const DescargasUserUpsertSchema = z.object({
  where: DescargasUserWhereUniqueInputObjectSchema,
  create: z.union([
    DescargasUserCreateInputObjectSchema,
    DescargasUserUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    DescargasUserUpdateInputObjectSchema,
    DescargasUserUncheckedUpdateInputObjectSchema,
  ]),
});
