import { z } from 'zod';
import { DescargasUserWhereUniqueInputObjectSchema } from './objects/DescargasUserWhereUniqueInput.schema';

export const DescargasUserFindUniqueSchema = z.object({
  where: DescargasUserWhereUniqueInputObjectSchema,
});
