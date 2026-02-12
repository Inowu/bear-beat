import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { claimManyChatHandoffToken } from '../../../many-chat/handoff';
import { manyChat } from '../../../many-chat';
import { log } from '../../../server';

const MAX_PRISMA_INT = 2147483647;

function tryParseMcId(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  if (n <= 0 || n > MAX_PRISMA_INT) return null;
  return n;
}

export const claimManyChatHandoff = shieldedProcedure
  .input(
    z.object({
      token: z.string().min(16).max(200),
    }),
  )
  .mutation(async ({ ctx: { prisma, session }, input }) => {
    const userId = session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No autorizado' });
    }

    const user = await prisma.users.findFirst({
      where: { id: userId },
    });

    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuario no encontrado' });
    }

    const result = await claimManyChatHandoffToken({
      prisma,
      token: input.token,
      userId,
    });

    if (!result.ok) {
      return { ok: false, reason: result.reason } as const;
    }

    const mcId = tryParseMcId(result.contactId);

    // Best-effort: push system fields back into ManyChat contact so future lookups/tags are stable.
    // Only persist users.mc_id if ManyChat accepts the id (avoid pinning an incompatible id).
    let updateOk = false;
    const canUpdateSubscriber = Boolean(mcId) && (!user.mc_id || user.mc_id === mcId);
    if (mcId && canUpdateSubscriber) {
      try {
        const updated = await manyChat.updateSubscriber(
          {
            first_name: user.first_name,
            last_name: user.last_name,
            phone: user.phone ?? undefined,
            email: user.email,
          },
          mcId,
          'Consent',
        );
        updateOk = Boolean(updated);
      } catch (e: any) {
        log.debug('[MANYCHAT_HANDOFF] ManyChat updateSubscriber skipped', {
          userId: user.id,
          mcId,
          error: e instanceof Error ? e.message : e,
        });
        updateOk = false;
      }
    }

    // If we can safely store the ManyChat contact ID into users.mc_id, do it once.
    if (mcId && updateOk && !user.mc_id) {
      try {
        await prisma.users.update({
          where: { id: user.id },
          data: { mc_id: mcId },
        });
      } catch (e: any) {
        log.warn('[MANYCHAT_HANDOFF] Failed to persist mc_id on user', {
          userId: user.id,
          mcId,
          error: e instanceof Error ? e.message : e,
        });
      }
    }

    return {
      ok: true,
      alreadyClaimed: result.alreadyClaimed,
      contactId: result.contactId,
      channel: result.channel,
    } as const;
  });
