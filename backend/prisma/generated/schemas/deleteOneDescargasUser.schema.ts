import { z } from 'zod';
import { DescargasUserWhereUniqueInputObjectSchema } from './objects/DescargasUserWhereUniqueInput.schema';

export const DescargasUserDeleteOneSchema = z.object({
  where: DescargasUserWhereUniqueInputObjectSchema,
});
