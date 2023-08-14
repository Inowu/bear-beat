import { z } from 'zod';
import { RolesOrderByWithRelationInputObjectSchema } from './objects/RolesOrderByWithRelationInput.schema';
import { RolesWhereInputObjectSchema } from './objects/RolesWhereInput.schema';
import { RolesWhereUniqueInputObjectSchema } from './objects/RolesWhereUniqueInput.schema';
import { RolesCountAggregateInputObjectSchema } from './objects/RolesCountAggregateInput.schema';
import { RolesMinAggregateInputObjectSchema } from './objects/RolesMinAggregateInput.schema';
import { RolesMaxAggregateInputObjectSchema } from './objects/RolesMaxAggregateInput.schema';
import { RolesAvgAggregateInputObjectSchema } from './objects/RolesAvgAggregateInput.schema';
import { RolesSumAggregateInputObjectSchema } from './objects/RolesSumAggregateInput.schema';

export const RolesAggregateSchema = z.object({
  orderBy: z
    .union([
      RolesOrderByWithRelationInputObjectSchema,
      RolesOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: RolesWhereInputObjectSchema.optional(),
  cursor: RolesWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([z.literal(true), RolesCountAggregateInputObjectSchema])
    .optional(),
  _min: RolesMinAggregateInputObjectSchema.optional(),
  _max: RolesMaxAggregateInputObjectSchema.optional(),
  _avg: RolesAvgAggregateInputObjectSchema.optional(),
  _sum: RolesSumAggregateInputObjectSchema.optional(),
});
