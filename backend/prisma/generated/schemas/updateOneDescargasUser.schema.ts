import { z } from 'zod';
import { DescargasUserUpdateInputObjectSchema } from './objects/DescargasUserUpdateInput.schema';
import { DescargasUserUncheckedUpdateInputObjectSchema } from './objects/DescargasUserUncheckedUpdateInput.schema';
import { DescargasUserWhereUniqueInputObjectSchema } from './objects/DescargasUserWhereUniqueInput.schema';

export const DescargasUserUpdateOneSchema = z.object({
  data: z.union([
    DescargasUserUpdateInputObjectSchema,
    DescargasUserUncheckedUpdateInputObjectSchema,
  ]),
  where: DescargasUserWhereUniqueInputObjectSchema,
});
