import { z } from 'zod';
import { ConfigSelectObjectSchema } from './objects/ConfigSelect.schema';
import { ConfigWhereUniqueInputObjectSchema } from './objects/ConfigWhereUniqueInput.schema';

export const ConfigDeleteOneSchema = z.object({
  select: ConfigSelectObjectSchema.optional(),
  where: ConfigWhereUniqueInputObjectSchema,
});
