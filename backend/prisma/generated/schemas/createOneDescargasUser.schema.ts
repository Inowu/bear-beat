import { z } from 'zod';
import { DescargasUserCreateInputObjectSchema } from './objects/DescargasUserCreateInput.schema';
import { DescargasUserUncheckedCreateInputObjectSchema } from './objects/DescargasUserUncheckedCreateInput.schema';

export const DescargasUserCreateOneSchema = z.object({
  data: z.union([
    DescargasUserCreateInputObjectSchema,
    DescargasUserUncheckedCreateInputObjectSchema,
  ]),
});
