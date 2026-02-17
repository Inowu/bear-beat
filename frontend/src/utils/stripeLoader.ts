import { loadStripe, type Stripe } from "@stripe/stripe-js";

export type StripeLoadFailureReason =
  | "stripe_key_missing"
  | "stripe_js_load_failed";

export class StripeLoadError extends Error {
  readonly reason: StripeLoadFailureReason;

  constructor(reason: StripeLoadFailureReason, message: string) {
    super(message);
    this.name = "StripeLoadError";
    this.reason = reason;
  }
}

const DEFAULT_STRIPE_LOAD_TIMEOUT_MS = 4500;
const stripePromiseCache = new Map<string, Promise<Stripe | null>>();

export function getStripePublishableKey(): string | null {
  const candidate =
    process.env.REACT_APP_ENVIRONMENT === "development"
      ? process.env.REACT_APP_STRIPE_TEST_KEY
      : process.env.REACT_APP_STRIPE_KEY;
  const normalized = `${candidate ?? ""}`.trim();
  return normalized ? normalized : null;
}

export function getStripePromise(
  publishableKey: string,
): Promise<Stripe | null> {
  const key = publishableKey.trim();
  const existing = stripePromiseCache.get(key);
  if (existing) return existing;
  const created = loadStripe(key);
  stripePromiseCache.set(key, created);
  return created;
}

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => Error,
): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(onTimeout());
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
};

export async function ensureStripeReady(options?: {
  publishableKey?: string | null;
  timeoutMs?: number;
}): Promise<{
  publishableKey: string;
  stripePromise: Promise<Stripe | null>;
}> {
  const publishableKey = options?.publishableKey ?? getStripePublishableKey();
  if (!publishableKey) {
    throw new StripeLoadError(
      "stripe_key_missing",
      "Stripe publishable key is not configured.",
    );
  }

  const stripePromise = getStripePromise(publishableKey);
  const timeoutMs = Number(options?.timeoutMs ?? DEFAULT_STRIPE_LOAD_TIMEOUT_MS);
  const resolvedTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.floor(timeoutMs)
    : DEFAULT_STRIPE_LOAD_TIMEOUT_MS;

  let stripe: Stripe | null = null;
  try {
    stripe = await withTimeout(
      stripePromise,
      resolvedTimeout,
      () =>
        new StripeLoadError(
          "stripe_js_load_failed",
          "Stripe.js did not load before timeout.",
        ),
    );
  } catch (error) {
    if (error instanceof StripeLoadError) {
      throw error;
    }
    throw new StripeLoadError(
      "stripe_js_load_failed",
      "Stripe.js failed to load.",
    );
  }

  if (!stripe) {
    throw new StripeLoadError(
      "stripe_js_load_failed",
      "Stripe.js did not return a valid Stripe instance.",
    );
  }

  return {
    publishableKey,
    stripePromise,
  };
}

export function getStripeLoadFailureReason(error: unknown): StripeLoadFailureReason {
  if (error instanceof StripeLoadError) return error.reason;
  return "stripe_js_load_failed";
}
