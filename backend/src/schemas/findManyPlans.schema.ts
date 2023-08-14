import { z } from 'zod';
import { PlansSelectObjectSchema } from './objects/PlansSelect.schema';
import { PlansOrderByWithRelationInputObjectSchema } from './objects/PlansOrderByWithRelationInput.schema';
import { PlansWhereInputObjectSchema } from './objects/PlansWhereInput.schema';
import { PlansWhereUniqueInputObjectSchema } from './objects/PlansWhereUniqueInput.schema';
import { PlansScalarFieldEnumSchema } from './enums/PlansScalarFieldEnum.schema';

export const PlansFindManySchema = z.object({
  select: z.lazy(() => PlansSelectObjectSchema.optional()),
  orderBy: z
    .union([
      PlansOrderByWithRelationInputObjectSchema,
      PlansOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: PlansWhereInputObjectSchema.optional(),
  cursor: PlansWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.array(PlansScalarFieldEnumSchema).optional(),
});
