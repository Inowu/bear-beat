import { z } from 'zod';
import { ConfigSelectObjectSchema } from './objects/ConfigSelect.schema';
import { ConfigWhereUniqueInputObjectSchema } from './objects/ConfigWhereUniqueInput.schema';
import { ConfigCreateInputObjectSchema } from './objects/ConfigCreateInput.schema';
import { ConfigUncheckedCreateInputObjectSchema } from './objects/ConfigUncheckedCreateInput.schema';
import { ConfigUpdateInputObjectSchema } from './objects/ConfigUpdateInput.schema';
import { ConfigUncheckedUpdateInputObjectSchema } from './objects/ConfigUncheckedUpdateInput.schema';

export const ConfigUpsertSchema = z.object({
  select: ConfigSelectObjectSchema.optional(),
  where: ConfigWhereUniqueInputObjectSchema,
  create: z.union([
    ConfigCreateInputObjectSchema,
    ConfigUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    ConfigUpdateInputObjectSchema,
    ConfigUncheckedUpdateInputObjectSchema,
  ]),
});
