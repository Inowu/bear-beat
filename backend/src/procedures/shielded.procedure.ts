import { permissionsMiddleware } from '../middleware/shield.middleware';
import { t } from '../trpc';

export const shieldedProcedure = t.procedure.use(permissionsMiddleware);
