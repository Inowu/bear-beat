export const CHECKOUT_INTENT_METHODS = [
  "card",
  "paypal",
  "spei",
  "oxxo",
  "bbva",
] as const;

export type CheckoutIntentMethod = (typeof CHECKOUT_INTENT_METHODS)[number];

export type CheckoutIntent = {
  isCheckoutIntent: boolean;
  intentMethod: CheckoutIntentMethod | null;
  intentAllowsTrial: boolean;
};

const CHECKOUT_PATH_PREFIXES = ["/comprar", "/checkout"] as const;
const checkoutMethodSet = new Set<string>(CHECKOUT_INTENT_METHODS);

function toUrl(value: string): URL | null {
  const raw = `${value ?? ""}`.trim();
  if (!raw) return null;
  try {
    if (typeof window !== "undefined") {
      return new URL(raw, window.location.origin);
    }
    return new URL(raw, "https://bearbeat.local");
  } catch {
    return null;
  }
}

function normalizeIntentMethod(value: unknown): CheckoutIntentMethod | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!checkoutMethodSet.has(normalized)) return null;
  return normalized as CheckoutIntentMethod;
}

export function parseCheckoutIntent(from: string): CheckoutIntent {
  const parsed = toUrl(from);
  if (!parsed) {
    return {
      isCheckoutIntent: false,
      intentMethod: null,
      intentAllowsTrial: true,
    };
  }

  const isCheckoutIntent = CHECKOUT_PATH_PREFIXES.some((prefix) =>
    parsed.pathname.startsWith(prefix),
  );
  if (!isCheckoutIntent) {
    return {
      isCheckoutIntent: false,
      intentMethod: null,
      intentAllowsTrial: true,
    };
  }

  const method = normalizeIntentMethod(parsed.searchParams.get("method")) ?? "card";
  return {
    isCheckoutIntent: true,
    intentMethod: method,
    intentAllowsTrial: method === "card",
  };
}
