import { z } from 'zod';
import { publicProcedure } from '../../../procedures/public.procedure';
import { verifyTurnstileToken } from '../../../utils/turnstile';
import { getMarketingTrialConfigFromEnv } from '../../../utils/trialConfig';
import {
  resolveMarketingTrialEligibility,
  type MarketingTrialIneligibilityReason,
} from '../../../utils/marketingTrialEligibility';

type StartTrialIneligibleReason =
  | 'trial_already_used'
  | 'already_paid_member'
  | 'phone_linked_history'
  | 'trial_disabled'
  | 'unknown';

function mapIneligibleReason(
  reason: MarketingTrialIneligibilityReason | null,
): StartTrialIneligibleReason {
  switch (reason) {
    case 'trial_used_at':
      return 'trial_already_used';
    case 'has_paid_order':
      return 'already_paid_member';
    case 'shared_phone_trial_history':
    case 'shared_phone_paid_history':
      return 'phone_linked_history';
    case 'trial_disabled':
      return 'trial_disabled';
    default:
      return 'unknown';
  }
}

export const startTrialByEmail = publicProcedure
  .input(
    z.object({
      email: z.string().email('Email inválido'),
      turnstileToken: z
        .string()
        .min(1, 'La verificación de seguridad es requerida'),
    }),
  )
  .mutation(async ({ input: { email, turnstileToken }, ctx: { prisma, req } }) => {
    await verifyTurnstileToken({ token: turnstileToken, remoteIp: req.ip });

    const trialConfig = getMarketingTrialConfigFromEnv();
    const trial = {
      enabled: trialConfig.enabled,
      days: trialConfig.days,
      gb: trialConfig.gb,
    };
    const normalizedEmail = email.trim();

    const user = await prisma.users.findFirst({
      where: { email: { equals: normalizedEmail } },
      select: { id: true, blocked: true, trial_used_at: true, phone: true },
    });

    if (!user) {
      let deletedUser: { id: number } | null = null;
      try {
        deletedUser = await prisma.deletedUsers.findFirst({
          where: { email: normalizedEmail },
          select: { id: true },
        });
      } catch {
        // Best-effort only: if `deleted_users` does not exist in this environment,
        // continue as a new account flow instead of failing the endpoint.
        deletedUser = null;
      }

      if (deletedUser) {
        return {
          nextAction: 'support' as const,
          accountState: 'existing_deleted' as const,
          trialState: 'ineligible' as const,
          trial,
          messageKey: 'deleted_account' as const,
          ineligibleReason: null,
        };
      }

      return {
        nextAction: 'register' as const,
        accountState: 'new' as const,
        trialState: 'unknown_for_new' as const,
        trial,
        messageKey: trialConfig.enabled
          ? ('new_account_trial' as const)
          : ('new_account_no_trial' as const),
        ineligibleReason: null,
      };
    }

    if (user.blocked) {
      return {
        nextAction: 'support' as const,
        accountState: 'existing_blocked' as const,
        trialState: 'ineligible' as const,
        trial,
        messageKey: 'blocked_account' as const,
        ineligibleReason: null,
      };
    }

    const trialEligibility = await resolveMarketingTrialEligibility({
      prisma,
      userId: user.id,
      user: {
        trial_used_at: user.trial_used_at,
        phone: user.phone,
      },
      trialConfig,
    });

    return {
      nextAction: 'login' as const,
      accountState: 'existing_active' as const,
      trialState: trialEligibility.eligible
        ? ('eligible' as const)
        : ('ineligible' as const),
      trial,
      messageKey: trialEligibility.eligible
        ? ('welcome_back_trial' as const)
        : ('welcome_back_no_trial' as const),
      ineligibleReason: trialEligibility.eligible
        ? null
        : mapIneligibleReason(trialEligibility.reason),
    };
  });
