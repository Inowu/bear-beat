import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { SessionUser } from '../routers/auth/utils/serialize-user';
import { getCatalogStats } from '../routers/file-actions/catalog-stats';
import type { CatalogStatsResult } from '../routers/file-actions/catalog-stats';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora
let cached: CatalogStatsResult | null = null;
let cachedAt = 0;

/** GET /api/catalog-stats — estadísticas del catálogo (requiere Bearer token). ?refresh=1 fuerza recalcular. */
export const catalogStatsEndpoint = async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
    return;
  }

  let user: SessionUser | null = null;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET as string) as SessionUser;
  } catch {
    res.status(401).json({ error: 'No autorizado. Token inválido o expirado.' });
    return;
  }

  if (!user?.id) {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }

  const forceRefresh = (req as Request & { query?: { refresh?: string } }).query?.refresh === '1';
  const useCache = !forceRefresh && cached && Date.now() - cachedAt < CACHE_TTL_MS;

  if (useCache) {
    res.json(cached);
    return;
  }

  const data = await getCatalogStats();
  cached = data;
  cachedAt = Date.now();
  res.json(data);
};
