import { z } from 'zod';
import { ConfigCreateInputObjectSchema } from './objects/ConfigCreateInput.schema';
import { ConfigUncheckedCreateInputObjectSchema } from './objects/ConfigUncheckedCreateInput.schema';

export const ConfigCreateOneSchema = z.object({
  data: z.union([
    ConfigCreateInputObjectSchema,
    ConfigUncheckedCreateInputObjectSchema,
  ]),
});
