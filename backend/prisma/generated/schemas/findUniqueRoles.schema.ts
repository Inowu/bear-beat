import { z } from 'zod';
import { RolesWhereUniqueInputObjectSchema } from './objects/RolesWhereUniqueInput.schema';

export const RolesFindUniqueSchema = z.object({
  where: RolesWhereUniqueInputObjectSchema,
});
