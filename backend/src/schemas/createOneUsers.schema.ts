import { z } from "zod";
import { UsersSelectObjectSchema } from "./objects/UsersSelect.schema";
import { UsersIncludeObjectSchema } from "./objects/UsersInclude.schema";
import { UsersCreateInputObjectSchema } from "./objects/UsersCreateInput.schema";
import { UsersUncheckedCreateInputObjectSchema } from "./objects/UsersUncheckedCreateInput.schema";

export const UsersCreateOneSchema = z.object({
  select: UsersSelectObjectSchema.optional(),
  include: UsersIncludeObjectSchema.optional(),
  //z.union([
  data: UsersCreateInputObjectSchema,
  // UsersUncheckedCreateInputObjectSchema,
  // ]),
});
