import { z } from 'zod';
import { ConfigWhereInputObjectSchema } from './objects/ConfigWhereInput.schema';

export const ConfigDeleteManySchema = z.object({
  where: ConfigWhereInputObjectSchema.optional(),
});
