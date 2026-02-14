import { shieldedProcedure } from '../../procedures/shielded.procedure';

export const getEmailPreferences = shieldedProcedure.query(async ({ ctx: { prisma, session } }) => {
  const userId = session!.user!.id;

  const user = await prisma.users.findFirst({
    where: { id: userId },
    select: {
      email_marketing_opt_in: true,
      email_marketing_news_opt_in: true,
      email_marketing_offers_opt_in: true,
      email_marketing_digest_opt_in: true,
      marketing_opt_in_updated_at: true,
    },
  });

  if (!user) {
    return {
      marketingEmail: {
        enabled: false,
        news: false,
        offers: false,
        digest: false,
        updatedAt: null,
      },
    };
  }

  // Defensive: treat global as a legacy field; the UI relies on category flags.
  const enabled =
    Boolean(user.email_marketing_news_opt_in)
    || Boolean(user.email_marketing_offers_opt_in)
    || Boolean(user.email_marketing_digest_opt_in);

  return {
    marketingEmail: {
      enabled: Boolean(user.email_marketing_opt_in) && enabled,
      news: Boolean(user.email_marketing_news_opt_in),
      offers: Boolean(user.email_marketing_offers_opt_in),
      digest: Boolean(user.email_marketing_digest_opt_in),
      updatedAt: user.marketing_opt_in_updated_at,
    },
    transactionalEmail: {
      // Transactional/support comms are required to operate the service.
      enabled: true,
      kinds: ['security', 'billing', 'cancellation', 'support'],
    },
  };
});

