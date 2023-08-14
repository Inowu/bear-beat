import { z } from 'zod';
import { DescargasUserUpdateManyMutationInputObjectSchema } from './objects/DescargasUserUpdateManyMutationInput.schema';
import { DescargasUserWhereInputObjectSchema } from './objects/DescargasUserWhereInput.schema';

export const DescargasUserUpdateManySchema = z.object({
  data: DescargasUserUpdateManyMutationInputObjectSchema,
  where: DescargasUserWhereInputObjectSchema.optional(),
});
