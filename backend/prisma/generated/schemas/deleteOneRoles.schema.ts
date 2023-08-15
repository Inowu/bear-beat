import { z } from 'zod';
import { RolesWhereUniqueInputObjectSchema } from './objects/RolesWhereUniqueInput.schema';

export const RolesDeleteOneSchema = z.object({
  where: RolesWhereUniqueInputObjectSchema,
});
