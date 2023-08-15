import { z } from 'zod';
import { PlansWhereUniqueInputObjectSchema } from './objects/PlansWhereUniqueInput.schema';
import { PlansCreateInputObjectSchema } from './objects/PlansCreateInput.schema';
import { PlansUncheckedCreateInputObjectSchema } from './objects/PlansUncheckedCreateInput.schema';
import { PlansUpdateInputObjectSchema } from './objects/PlansUpdateInput.schema';
import { PlansUncheckedUpdateInputObjectSchema } from './objects/PlansUncheckedUpdateInput.schema';

export const PlansUpsertSchema = z.object({
  where: PlansWhereUniqueInputObjectSchema,
  create: z.union([
    PlansCreateInputObjectSchema,
    PlansUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    PlansUpdateInputObjectSchema,
    PlansUncheckedUpdateInputObjectSchema,
  ]),
});
