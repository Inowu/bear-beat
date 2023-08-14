import { z } from 'zod';
import { ConfigSelectObjectSchema } from './objects/ConfigSelect.schema';
import { ConfigCreateInputObjectSchema } from './objects/ConfigCreateInput.schema';
import { ConfigUncheckedCreateInputObjectSchema } from './objects/ConfigUncheckedCreateInput.schema';

export const ConfigCreateOneSchema = z.object({
  select: ConfigSelectObjectSchema.optional(),
  data: z.union([
    ConfigCreateInputObjectSchema,
    ConfigUncheckedCreateInputObjectSchema,
  ]),
});
