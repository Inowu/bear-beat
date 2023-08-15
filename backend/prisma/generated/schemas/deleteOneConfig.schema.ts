import { z } from 'zod';
import { ConfigWhereUniqueInputObjectSchema } from './objects/ConfigWhereUniqueInput.schema';

export const ConfigDeleteOneSchema = z.object({
  where: ConfigWhereUniqueInputObjectSchema,
});
