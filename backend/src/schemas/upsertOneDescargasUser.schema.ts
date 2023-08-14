import { z } from 'zod';
import { DescargasUserSelectObjectSchema } from './objects/DescargasUserSelect.schema';
import { DescargasUserWhereUniqueInputObjectSchema } from './objects/DescargasUserWhereUniqueInput.schema';
import { DescargasUserCreateInputObjectSchema } from './objects/DescargasUserCreateInput.schema';
import { DescargasUserUncheckedCreateInputObjectSchema } from './objects/DescargasUserUncheckedCreateInput.schema';
import { DescargasUserUpdateInputObjectSchema } from './objects/DescargasUserUpdateInput.schema';
import { DescargasUserUncheckedUpdateInputObjectSchema } from './objects/DescargasUserUncheckedUpdateInput.schema';

export const DescargasUserUpsertSchema = z.object({
  select: DescargasUserSelectObjectSchema.optional(),
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
