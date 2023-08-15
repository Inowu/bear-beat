import { z } from 'zod';
import { ConfigUpdateInputObjectSchema } from './objects/ConfigUpdateInput.schema';
import { ConfigUncheckedUpdateInputObjectSchema } from './objects/ConfigUncheckedUpdateInput.schema';
import { ConfigWhereUniqueInputObjectSchema } from './objects/ConfigWhereUniqueInput.schema';

export const ConfigUpdateOneSchema = z.object({
  data: z.union([
    ConfigUpdateInputObjectSchema,
    ConfigUncheckedUpdateInputObjectSchema,
  ]),
  where: ConfigWhereUniqueInputObjectSchema,
});
