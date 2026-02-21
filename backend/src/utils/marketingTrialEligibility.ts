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

/**
 * Centralized marketing trial eligibility check (first-time trial guard).
 * Rules:
 * - Trial feature must be enabled in env.
 * - User must not have used trial before (`trial_used_at`).
 * - User must not have previous paid plan orders.
 * - Anti-abuse: if another account with same phone already used trial
 *   or has paid plan orders, this user is not eligible.
 */
export async function isUserEligibleForMarketingTrial(
  params: IsUserEligibleForMarketingTrialParams,
): Promise<boolean> {
  const { prisma, userId } = params;
  const trialConfig = params.trialConfig ?? getMarketingTrialConfigFromEnv();

  if (!trialConfig.enabled) return false;

  const user = params.user
    ? {
        trial_used_at: params.user.trial_used_at,
        phone: params.user.phone,
      }
    : await prisma.users.findFirst({
        where: { id: userId },
        select: { trial_used_at: true, phone: true },
      });

  if (!user) return false;
  if (user.trial_used_at) return false;

  const previousPaidPlanOrder = await prisma.orders.findFirst({
    where: {
      user_id: userId,
      status: OrderStatus.PAID,
      is_plan: 1,
    },
    select: { id: true },
  });

  if (previousPaidPlanOrder) return false;

  const phone = (user.phone ?? '').trim();
  if (!phone) return true;

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
    if (samePhoneHasTrial) return false;

    if (samePhoneUsers.length > 0) {
      const paid = await prisma.orders.findFirst({
        where: {
          user_id: { in: samePhoneUsers.map((row) => row.id) },
          status: OrderStatus.PAID,
          is_plan: 1,
        },
        select: { id: true },
      });
      if (paid) return false;
    }
  } catch {
    // Best-effort only: do not fail eligibility if anti-abuse lookup errors out.
  }

  return true;
}
