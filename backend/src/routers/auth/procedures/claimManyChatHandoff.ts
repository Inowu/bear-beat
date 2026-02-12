import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { claimManyChatHandoffToken } from '../../../many-chat/handoff';
import { manyChat } from '../../../many-chat';
import { log } from '../../../server';

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

    const contactId = `${result.contactId ?? ''}`.trim();

    // Best-effort: push system fields back into ManyChat contact so future lookups/tags are stable.
    // ManyChat IDs are long numeric strings; do NOT coerce to Number.
    if (contactId) {
      try {
        await manyChat.updateSubscriber(
          {
            first_name: user.first_name,
            last_name: user.last_name,
            phone: user.phone ?? undefined,
            email: user.email,
          },
          contactId,
          'Consent',
        );
      } catch (e: any) {
        log.debug('[MANYCHAT_HANDOFF] ManyChat updateSubscriber skipped', {
          userId: user.id,
          contactId,
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
