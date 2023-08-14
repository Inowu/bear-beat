import { z } from 'zod';
import { DescargasUserSelectObjectSchema } from './objects/DescargasUserSelect.schema';
import { DescargasUserUpdateInputObjectSchema } from './objects/DescargasUserUpdateInput.schema';
import { DescargasUserUncheckedUpdateInputObjectSchema } from './objects/DescargasUserUncheckedUpdateInput.schema';
import { DescargasUserWhereUniqueInputObjectSchema } from './objects/DescargasUserWhereUniqueInput.schema';

export const DescargasUserUpdateOneSchema = z.object({
  select: DescargasUserSelectObjectSchema.optional(),
  data: z.union([
    DescargasUserUpdateInputObjectSchema,
    DescargasUserUncheckedUpdateInputObjectSchema,
  ]),
  where: DescargasUserWhereUniqueInputObjectSchema,
});
