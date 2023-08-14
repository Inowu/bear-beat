import { z } from 'zod';
import { DescargasUserSelectObjectSchema } from './objects/DescargasUserSelect.schema';
import { DescargasUserWhereUniqueInputObjectSchema } from './objects/DescargasUserWhereUniqueInput.schema';

export const DescargasUserFindUniqueSchema = z.object({
  select: DescargasUserSelectObjectSchema.optional(),
  where: DescargasUserWhereUniqueInputObjectSchema,
});
