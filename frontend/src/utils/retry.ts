export interface RetryWithJitterOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (params: { error: unknown; attempt: number; waitMs: number }) => void;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 2000;
const DEFAULT_JITTER_MS = 350;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getHttpStatusFromError = (error: unknown): number | null => {
  const candidate = error as any;
  const sources = [
    candidate?.data?.httpStatus,
    candidate?.shape?.data?.httpStatus,
    candidate?.meta?.response?.status,
    candidate?.response?.status,
    candidate?.status,
  ];

  for (const source of sources) {
    const parsed = toFiniteNumber(source);
    if (parsed !== null) {
      return Math.floor(parsed);
    }
  }

  return null;
};

export const isRetryableMediaError = (error: unknown): boolean => {
  const status = getHttpStatusFromError(error);
  if (status === 429) return true;
  if (status !== null && status >= 500) return true;
  if (status !== null && status >= 400 && status < 500) return false;

  const message = `${(error as any)?.message ?? ''}`.toLowerCase();
  if (!message) return false;

  return [
    'failed to fetch',
    'networkerror',
    'network error',
    'timeout',
    'econnreset',
    'temporarily unavailable',
    'fetch failed',
  ].some((snippet) => message.includes(snippet));
};

export async function retryWithJitter<T>(
  task: () => Promise<T>,
  options: RetryWithJitterOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS));
  const baseDelayMs = Math.max(0, Math.floor(options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS));
  const maxDelayMs = Math.max(baseDelayMs, Math.floor(options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS));
  const jitterMs = Math.max(0, Math.floor(options.jitterMs ?? DEFAULT_JITTER_MS));
  const shouldRetry = options.shouldRetry ?? (() => true);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const canRetry = attempt < maxAttempts && shouldRetry(error, attempt);
      if (!canRetry) {
        throw error;
      }

      const exponentialDelayMs = Math.min(maxDelayMs, baseDelayMs * (2 ** (attempt - 1)));
      const jitterOffsetMs = jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0;
      const waitMs = exponentialDelayMs + jitterOffsetMs;

      options.onRetry?.({
        error,
        attempt,
        waitMs,
      });

      await sleep(waitMs);
    }
  }

  throw new Error('retryWithJitter exhausted attempts');
}
