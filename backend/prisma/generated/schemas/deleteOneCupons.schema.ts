import { z } from 'zod';
import { CuponsWhereUniqueInputObjectSchema } from './objects/CuponsWhereUniqueInput.schema';

export const CuponsDeleteOneSchema = z.object({
  where: CuponsWhereUniqueInputObjectSchema,
});
