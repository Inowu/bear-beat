import { z } from 'zod';
import { DescargasUserWhereInputObjectSchema } from './objects/DescargasUserWhereInput.schema';

export const DescargasUserDeleteManySchema = z.object({
  where: DescargasUserWhereInputObjectSchema.optional(),
});
