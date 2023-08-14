import { Users } from "@prisma/client";
import { RolesIds, RolesNames } from "../interfaces/roles.interface";

export type SessionUser = {
  id: number;
  role: RolesNames;
  username: string;
  email: string;
  profileImg: string;
};

export const serializeUser = (user: Users) => {
  return {
    id: user.id,
    role: getRoleFromId(user.role_id),
    username: user.username,
    email: user.email,
    profileImg: user.profile_img,
  };
};

const getRoleFromId = (roleId?: number | null): RolesNames => {
  switch (roleId) {
    case RolesIds.admin:
      return RolesNames.admin;
    case RolesIds.subadmin:
      return RolesNames.subadmin;
    case RolesIds.editor:
      return RolesNames.editor;
    case RolesIds.normal:
    default:
      return RolesNames.normal;
  }
};
