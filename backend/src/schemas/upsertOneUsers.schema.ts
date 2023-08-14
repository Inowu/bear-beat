import { z } from "zod";
import { UsersSelectObjectSchema } from "./objects/UsersSelect.schema";
import { UsersIncludeObjectSchema } from "./objects/UsersInclude.schema";
import { UsersWhereUniqueInputObjectSchema } from "./objects/UsersWhereUniqueInput.schema";
import { UsersCreateInputObjectSchema } from "./objects/UsersCreateInput.schema";
import { UsersUncheckedCreateInputObjectSchema } from "./objects/UsersUncheckedCreateInput.schema";
import { UsersUpdateInputObjectSchema } from "./objects/UsersUpdateInput.schema";
import { UsersUncheckedUpdateInputObjectSchema } from "./objects/UsersUncheckedUpdateInput.schema";

export const UsersUpsertSchema = z.object({
  select: UsersSelectObjectSchema.optional(),
  include: UsersIncludeObjectSchema.optional(),
  where: UsersWhereUniqueInputObjectSchema,
  //z.union([
  create: UsersCreateInputObjectSchema,
  // UsersUncheckedCreateInputObjectSchema,
  // ]),
  //z.union([
  update: UsersUpdateInputObjectSchema,
  // UsersUncheckedUpdateInputObjectSchema,
  // ]),
});
