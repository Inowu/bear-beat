import axios, { AxiosError } from 'axios';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';

export const storage = shieldedProcedure.query(async () => {
  try {
    const response = await axios('http://0.0.0.0:8123/');

    return response.data;
  } catch (e: unknown) {
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
