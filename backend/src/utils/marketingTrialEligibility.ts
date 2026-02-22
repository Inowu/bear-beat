import { PrismaClient } from '@prisma/client';
import { OrderStatus } from '../routers/subscriptions/interfaces/order-status.interface';
import {
  getMarketingTrialConfigFromEnv,
  MarketingTrialConfig,
} from './trialConfig';

type TrialEligibilityUser = {
  trial_used_at: Date | null;
  phone: string | null;
};

type IsUserEligibleForMarketingTrialParams = {
  prisma: PrismaClient;
  userId: number;
  user?: TrialEligibilityUser | null;
  trialConfig?: MarketingTrialConfig;
};

export type MarketingTrialIneligibilityReason =
  | 'trial_disabled'
  | 'user_not_found'
  | 'trial_used_at'
  | 'has_paid_order'
  | 'shared_phone_trial_history'
  | 'shared_phone_paid_history';

export type MarketingTrialEligibilityResult = {
  eligible: boolean;
  reason: MarketingTrialIneligibilityReason | null;
};

/**
 * Centralized marketing trial eligibility check (first-time trial guard).
 * Rules:
 * - Trial feature must be enabled in env.
 * - User must not have used trial before (`trial_used_at`).
 * - User must not have previous paid plan orders.
 * - Anti-abuse: if another account with same phone already used trial
 *   or has paid plan orders, this user is not eligible.
 */
export async function resolveMarketingTrialEligibility(
  params: IsUserEligibleForMarketingTrialParams,
): Promise<MarketingTrialEligibilityResult> {
  const { prisma, userId } = params;
  const trialConfig = params.trialConfig ?? getMarketingTrialConfigFromEnv();

  if (!trialConfig.enabled) {
    return { eligible: false, reason: 'trial_disabled' };
  }

  const user = params.user
    ? {
        trial_used_at: params.user.trial_used_at,
        phone: params.user.phone,
      }
    : await prisma.users.findFirst({
        where: { id: userId },
        select: { trial_used_at: true, phone: true },
      });

  if (!user) {
    return { eligible: false, reason: 'user_not_found' };
  }
  if (user.trial_used_at) {
    return { eligible: false, reason: 'trial_used_at' };
  }

  const previousPaidPlanOrder = await prisma.orders.findFirst({
    where: {
      user_id: userId,
      status: OrderStatus.PAID,
      is_plan: 1,
    },
    select: { id: true },
  });

  if (previousPaidPlanOrder) {
    return { eligible: false, reason: 'has_paid_order' };
  }

  const phone = (user.phone ?? '').trim();
  if (!phone) {
    return { eligible: true, reason: null };
  }

  try {
    const samePhoneUsers = await prisma.users.findMany({
      where: {
        id: { not: userId },
        phone,
      },
      select: { id: true, trial_used_at: true },
      take: 5,
    });

    const samePhoneHasTrial = samePhoneUsers.some((row) =>
      Boolean(row.trial_used_at),
    );
    if (samePhoneHasTrial) {
      return { eligible: false, reason: 'shared_phone_trial_history' };
    }

    if (samePhoneUsers.length > 0) {
      const paid = await prisma.orders.findFirst({
        where: {
          user_id: { in: samePhoneUsers.map((row) => row.id) },
          status: OrderStatus.PAID,
          is_plan: 1,
        },
        select: { id: true },
      });
      if (paid) {
        return { eligible: false, reason: 'shared_phone_paid_history' };
      }
    }
  } catch {
    // Best-effort only: do not fail eligibility if anti-abuse lookup errors out.
  }

  return { eligible: true, reason: null };
}

export async function isUserEligibleForMarketingTrial(
  params: IsUserEligibleForMarketingTrialParams,
): Promise<boolean> {
  const result = await resolveMarketingTrialEligibility(params);
  return result.eligible;
}
