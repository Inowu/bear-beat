import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  analyticsEventBatchSchema,
  getClientIpFromRequest,
  ingestAnalyticsEvents,
} from '../analytics';
import { prisma } from '../db';
import { SessionUser } from '../routers/auth/utils/serialize-user';

const getSessionUserIdFromAuthorization = (auth?: string): number | null => {
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as SessionUser;
    return decoded.id ?? null;
  } catch {
    return null;
  }
};

export const analyticsCollectEndpoint = async (req: Request, res: Response) => {
  if (!process.env.DATABASE_URL) {
    res.status(202).json({
      accepted: 0,
      skipped: true,
      reason: 'analytics-db-not-configured',
    });
    return;
  }

  const parsedInput = analyticsEventBatchSchema.safeParse(req.body);
  if (!parsedInput.success) {
    res.status(400).json({
      message: 'Payload inválido',
      issues: parsedInput.error.issues.slice(0, 3),
    });
    return;
  }

  const sessionUserId = getSessionUserIdFromAuthorization(req.headers.authorization);
  const clientIp = getClientIpFromRequest(req);
  const userAgent = req.headers['user-agent'];

  try {
    const result = await ingestAnalyticsEvents({
      prisma,
      events: parsedInput.data.events,
      sessionUserId,
      clientIp,
      userAgent: typeof userAgent === 'string' ? userAgent : null,
    });
    res.status(202).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo registrar analytics';
    res.status(500).json({ message });
  }
};
