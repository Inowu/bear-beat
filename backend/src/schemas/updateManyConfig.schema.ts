import { z } from 'zod';
import { ConfigUpdateManyMutationInputObjectSchema } from './objects/ConfigUpdateManyMutationInput.schema';
import { ConfigWhereInputObjectSchema } from './objects/ConfigWhereInput.schema';

export const ConfigUpdateManySchema = z.object({
  data: ConfigUpdateManyMutationInputObjectSchema,
  where: ConfigWhereInputObjectSchema.optional(),
});
