import { z } from 'zod';
import { ConfigSelectObjectSchema } from './objects/ConfigSelect.schema';
import { ConfigUpdateInputObjectSchema } from './objects/ConfigUpdateInput.schema';
import { ConfigUncheckedUpdateInputObjectSchema } from './objects/ConfigUncheckedUpdateInput.schema';
import { ConfigWhereUniqueInputObjectSchema } from './objects/ConfigWhereUniqueInput.schema';

export const ConfigUpdateOneSchema = z.object({
  select: ConfigSelectObjectSchema.optional(),
  data: z.union([
    ConfigUpdateInputObjectSchema,
    ConfigUncheckedUpdateInputObjectSchema,
  ]),
  where: ConfigWhereUniqueInputObjectSchema,
});
