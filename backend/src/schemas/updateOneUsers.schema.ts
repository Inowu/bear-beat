import { z } from "zod";
import { UsersSelectObjectSchema } from "./objects/UsersSelect.schema";
import { UsersIncludeObjectSchema } from "./objects/UsersInclude.schema";
import { UsersUpdateInputObjectSchema } from "./objects/UsersUpdateInput.schema";
import { UsersUncheckedUpdateInputObjectSchema } from "./objects/UsersUncheckedUpdateInput.schema";
import { UsersWhereUniqueInputObjectSchema } from "./objects/UsersWhereUniqueInput.schema";

export const UsersUpdateOneSchema = z.object({
  select: UsersSelectObjectSchema.optional(),
  include: UsersIncludeObjectSchema.optional(),
  //z.union([
  data: UsersUpdateInputObjectSchema,
  // UsersUncheckedUpdateInputObjectSchema,
  // ]),
  where: UsersWhereUniqueInputObjectSchema,
});
