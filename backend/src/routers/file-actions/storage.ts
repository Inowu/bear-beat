import axios, { AxiosError } from 'axios';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';

export const storage = shieldedProcedure.query(async () => {
  const fallback = {
    used_storage: 0,
    total_storage: 0,
    available_storage: 0,
    degraded: true,
  };

  try {
    const storageServerUrl =
      process.env.STORAGE_SERVER_URL?.trim() || 'http://0.0.0.0:8123/';
    const response = await axios(storageServerUrl, {
      timeout: 4000,
    });

    return response.data;
  } catch (e: unknown) {
    if (axios.isAxiosError(e)) {
      const error = e as AxiosError;
      const status = error.response?.status ?? null;
      const code = error.code ?? null;

      if (process.env.NODE_ENV === 'production') {
        log.error(
          `[STORAGE] Storage server request failed (status=${status ?? 'n/a'}, code=${code ?? 'n/a'}): ${error.message}`,
        );
      } else {
        log.warn(
          `[STORAGE] Storage server unavailable (status=${status ?? 'n/a'}, code=${code ?? 'n/a'}): ${error.message}`,
        );
      }
    } else if (process.env.NODE_ENV === 'production') {
      log.error(`[STORAGE] Storage server request failed: ${String(e)}`);
    } else {
      log.warn(`[STORAGE] Storage server unavailable: ${String(e)}`);
    }

    // Admin UX: degrade gracefully (avoid 500s) and keep dashboards usable.
    return fallback;
  }
});
