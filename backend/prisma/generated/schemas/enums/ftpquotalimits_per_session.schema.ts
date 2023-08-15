import { z } from 'zod';

export const ftpquotalimits_per_sessionSchema = z.enum(['false', 'true']);
