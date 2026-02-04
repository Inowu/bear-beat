import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { SessionUser } from '../routers/auth/utils/serialize-user';
import { getCatalogStats } from '../routers/file-actions/catalog-stats';

/** GET /api/catalog-stats — estadísticas del catálogo (requiere Bearer token). No pasa por tRPC. */
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

  const data = await getCatalogStats();
  res.json(data);
};
