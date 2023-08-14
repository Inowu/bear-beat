import { z } from 'zod';
import { DescargasUserSelectObjectSchema } from './objects/DescargasUserSelect.schema';
import { DescargasUserCreateInputObjectSchema } from './objects/DescargasUserCreateInput.schema';
import { DescargasUserUncheckedCreateInputObjectSchema } from './objects/DescargasUserUncheckedCreateInput.schema';

export const DescargasUserCreateOneSchema = z.object({
  select: DescargasUserSelectObjectSchema.optional(),
  data: z.union([
    DescargasUserCreateInputObjectSchema,
    DescargasUserUncheckedCreateInputObjectSchema,
  ]),
});
