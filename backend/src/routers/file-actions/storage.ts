import axios, { AxiosError } from 'axios';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';

export const storage = shieldedProcedure.query(async () => {
  try {
    const storageServerUrl =
      process.env.STORAGE_SERVER_URL?.trim() || 'http://0.0.0.0:8123/';
    const response = await axios(storageServerUrl);

    return response.data;
  } catch (e: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      log.warn('[STORAGE] Storage server unavailable; returning empty stats in non-production.');
      return {
        used_storage: 0,
        total_storage: 0,
        available_storage: 0,
      };
    }

    if (axios.isAxiosError(e)) {
      const error = e as AxiosError;

      log.error(
        `[STORAGE] Error while retrieving os storage: ${
          error?.response?.data ?? error.message
        }`,
      );
    }

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error al obtener el espacio de almacenamiento',
    });
  }
});
