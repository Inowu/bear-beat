import type { Prisma, PrismaClient } from '@prisma/client';
import { log } from '../../server';

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string | null;
  socket?: {
    remoteAddress?: string | null;
  };
};

interface CreateAdminAuditLogInput {
  prisma: PrismaClient;
  actorUserId: number;
  action: string;
  req?: RequestLike | null;
  targetUserId?: number | null;
  metadata?: Prisma.InputJsonValue | null;
}

const MAX_ACTION_LENGTH = 80;
const MAX_USER_AGENT_LENGTH = 500;

const trimToLength = (value: string, maxLength: number): string =>
  value.slice(0, maxLength);

const normalizeUserAgent = (
  headerValue: string | string[] | undefined,
): string | null => {
  const userAgentRaw = Array.isArray(headerValue)
    ? headerValue[0]
    : headerValue;
  if (!userAgentRaw || typeof userAgentRaw !== 'string') return null;

  const trimmed = userAgentRaw.trim();
  if (!trimmed) return null;

  return trimToLength(trimmed, MAX_USER_AGENT_LENGTH);
};

export const createAdminAuditLog = async ({
  prisma,
  actorUserId,
  action,
  req,
  targetUserId,
  metadata,
}: CreateAdminAuditLogInput): Promise<void> => {
  try {
    // Do not capture/store IP addresses in admin audit logs (PII).
    const ip = null;
    const userAgent = normalizeUserAgent(req?.headers?.['user-agent']);
    const normalizedAction = trimToLength(
      action.trim(),
      MAX_ACTION_LENGTH,
    );

    if (!normalizedAction) return;

    await prisma.adminAuditLog.create({
      data: {
        actor_user_id: actorUserId,
        action: normalizedAction,
        target_user_id: targetUserId ?? null,
        metadata_json: metadata ?? undefined,
        ip: ip ?? null,
        user_agent: userAgent,
      },
    });
  } catch (error) {
    log.error('[ADMIN_AUDIT] Failed to persist admin audit log', {
      actorUserId,
      action,
      targetUserId: targetUserId ?? null,
      errorType: error instanceof Error ? error.name : typeof error,
    });
  }
};
