import { z } from "zod";
import { ConfigOrderByWithRelationInputObjectSchema } from "./objects/ConfigOrderByWithRelationInput.schema";
import { ConfigWhereInputObjectSchema } from "./objects/ConfigWhereInput.schema";
import { ConfigWhereUniqueInputObjectSchema } from "./objects/ConfigWhereUniqueInput.schema";
import { ConfigCountAggregateInputObjectSchema } from "./objects/ConfigCountAggregateInput.schema";
import { ConfigMinAggregateInputObjectSchema } from "./objects/ConfigMinAggregateInput.schema";
import { ConfigMaxAggregateInputObjectSchema } from "./objects/ConfigMaxAggregateInput.schema";
import { ConfigAvgAggregateInputObjectSchema } from "./objects/ConfigAvgAggregateInput.schema";
import { ConfigSumAggregateInputObjectSchema } from "./objects/ConfigSumAggregateInput.schema";

export const ConfigAggregateSchema = z.object({
  orderBy: z
    .union([
      ConfigOrderByWithRelationInputObjectSchema,
      ConfigOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: ConfigWhereInputObjectSchema.optional(),
  cursor: ConfigWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([z.literal(true), ConfigCountAggregateInputObjectSchema])
    .optional(),
  _min: ConfigMinAggregateInputObjectSchema.optional(),
  _max: ConfigMaxAggregateInputObjectSchema.optional(),
  _avg: ConfigAvgAggregateInputObjectSchema.optional(),
  _sum: ConfigSumAggregateInputObjectSchema.optional(),
});
