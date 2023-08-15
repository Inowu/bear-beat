import { z } from 'zod';
import { ConfigWhereUniqueInputObjectSchema } from './objects/ConfigWhereUniqueInput.schema';

export const ConfigFindUniqueSchema = z.object({
  where: ConfigWhereUniqueInputObjectSchema,
});
