import { z } from 'zod';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { applyEmailMarketingPrefsPatch } from '../../comms/emailPreferences';

export const updateEmailPreferences = shieldedProcedure
  .input(
    z
      .object({
        enabled: z.boolean().optional(),
        news: z.boolean().optional(),
        offers: z.boolean().optional(),
        digest: z.boolean().optional(),
      })
      .refine(
        (v) =>
          v.enabled !== undefined || v.news !== undefined || v.offers !== undefined || v.digest !== undefined,
        { message: 'No changes provided' },
      ),
  )
  .mutation(async ({ input, ctx: { prisma, session } }) => {
    const userId = session!.user!.id;

    const current = await prisma.users.findFirst({
      where: { id: userId },
      select: {
        email_marketing_news_opt_in: true,
        email_marketing_offers_opt_in: true,
        email_marketing_digest_opt_in: true,
      },
    });

    const { next, enabled } = applyEmailMarketingPrefsPatch(
      {
        news: Boolean(current?.email_marketing_news_opt_in),
        offers: Boolean(current?.email_marketing_offers_opt_in),
        digest: Boolean(current?.email_marketing_digest_opt_in),
      },
      input,
    );

    const updated = await prisma.users.update({
      where: { id: userId },
      data: {
        email_marketing_opt_in: enabled,
        email_marketing_news_opt_in: next.news,
        email_marketing_offers_opt_in: next.offers,
        email_marketing_digest_opt_in: next.digest,
        marketing_opt_in_updated_at: new Date(),
      },
      select: {
        email_marketing_opt_in: true,
        email_marketing_news_opt_in: true,
        email_marketing_offers_opt_in: true,
        email_marketing_digest_opt_in: true,
        marketing_opt_in_updated_at: true,
      },
    });

    return {
      marketingEmail: {
        enabled: Boolean(updated.email_marketing_opt_in),
        news: Boolean(updated.email_marketing_news_opt_in),
        offers: Boolean(updated.email_marketing_offers_opt_in),
        digest: Boolean(updated.email_marketing_digest_opt_in),
        updatedAt: updated.marketing_opt_in_updated_at,
      },
    };
  });

