import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { RolesIds, RolesNames } from '../interfaces/roles.interface';
import { generateTokens } from './utils/generateTokens';
import { serializeUser } from '../utils/serialize-user';
import { createAdminAuditLog } from '../../utils/adminAuditLog';

export const impersonateUser = shieldedProcedure
  .input(
    z.object({
      userId: z.number().int().positive(),
    }),
  )
  .mutation(async ({ input: { userId }, ctx: { prisma, session, req } }) => {
    if (session?.user?.role !== RolesNames.admin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Solo administradores pueden acceder como otro usuario',
      });
    }

    const targetUser = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Usuario no encontrado',
      });
    }

    if (targetUser.role_id === RolesIds.admin) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No puedes acceder a la cuenta de un administrador',
      });
    }

    if (targetUser.blocked) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No puedes acceder a una cuenta bloqueada',
      });
    }

    const tokens = await generateTokens(prisma, targetUser);
    await createAdminAuditLog({
      prisma,
      req,
      actorUserId: session.user.id,
      action: 'impersonate_user',
      targetUserId: targetUser.id,
      metadata: {
        targetRoleId: targetUser.role_id,
      },
    });

    return {
      ...tokens,
      user: serializeUser(targetUser),
    };
  });
