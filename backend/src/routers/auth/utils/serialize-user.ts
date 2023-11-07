import { Users } from '@prisma/client';
import { RolesIds, RolesNames } from '../interfaces/roles.interface';

export type SessionUser = {
  id: number;
  role: RolesNames;
  username: string;
  email: string;
  profileImg: string;
  stripeCusId: string;
};

export const serializeUser = (user: Users) => ({
  id: user.id,
  role: getRoleFromId(user.role_id),
  username: user.username,
  phone: user.phone,
  email: user.email,
  profileImg: user.profile_img,
  stripeCusId: user.stripe_cusid,
});

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
