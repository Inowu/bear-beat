import { permissions } from "../permissions";
import { t } from "../trpc";

export const permissionsMiddleware = t.middleware(permissions);
