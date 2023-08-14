import { z } from 'zod';
import { UserFilesOrderByWithRelationInputObjectSchema } from './objects/UserFilesOrderByWithRelationInput.schema';
import { UserFilesWhereInputObjectSchema } from './objects/UserFilesWhereInput.schema';
import { UserFilesWhereUniqueInputObjectSchema } from './objects/UserFilesWhereUniqueInput.schema';
import { UserFilesCountAggregateInputObjectSchema } from './objects/UserFilesCountAggregateInput.schema';
import { UserFilesMinAggregateInputObjectSchema } from './objects/UserFilesMinAggregateInput.schema';
import { UserFilesMaxAggregateInputObjectSchema } from './objects/UserFilesMaxAggregateInput.schema';
import { UserFilesAvgAggregateInputObjectSchema } from './objects/UserFilesAvgAggregateInput.schema';
import { UserFilesSumAggregateInputObjectSchema } from './objects/UserFilesSumAggregateInput.schema';

export const UserFilesAggregateSchema = z.object({
  orderBy: z
    .union([
      UserFilesOrderByWithRelationInputObjectSchema,
      UserFilesOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: UserFilesWhereInputObjectSchema.optional(),
  cursor: UserFilesWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([z.literal(true), UserFilesCountAggregateInputObjectSchema])
    .optional(),
  _min: UserFilesMinAggregateInputObjectSchema.optional(),
  _max: UserFilesMaxAggregateInputObjectSchema.optional(),
  _avg: UserFilesAvgAggregateInputObjectSchema.optional(),
  _sum: UserFilesSumAggregateInputObjectSchema.optional(),
});
