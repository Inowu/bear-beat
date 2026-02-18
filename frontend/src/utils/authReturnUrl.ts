const AUTH_RETURN_URL_KEY = "bb.auth.returnUrl";
const AUTH_RETURN_URL_TTL_MS = 20 * 60 * 1000; // 20 minutes
const AUTH_RETURN_ALLOWED_PATH_PREFIXES = [
  "/comprar",
  "/planes",
  "/descargas",
  "/micuenta",
] as const;

function normalizeAuthReturnPathname(pathname: string): string | null {
  const normalizedPath = `${pathname ?? ""}`.trim();
  if (!normalizedPath.startsWith("/")) return null;

  const isAllowed = AUTH_RETURN_ALLOWED_PATH_PREFIXES.some(
    (prefix) =>
      normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  );
  if (!isAllowed) return null;
  return normalizedPath;
}

export function normalizeAuthReturnUrl(url: string): string | null {
  if (typeof url !== "string") return null;
  const raw = url.trim();
  if (!raw) return null;

  try {
    const fallbackOrigin = "https://app.thebearbeat.local";
    const origin =
      typeof window === "undefined" ? fallbackOrigin : window.location.origin;
    const parsed = new URL(raw, origin);
    if (typeof window !== "undefined" && parsed.origin !== window.location.origin)
      return null;
    if (typeof window === "undefined" && !raw.startsWith("/")) return null;
    const pathname = normalizeAuthReturnPathname(parsed.pathname);
    if (!pathname) return null;
    return `${pathname}${parsed.search || ""}`;
  } catch {
    return null;
  }
}

export function writeAuthReturnUrl(url: string): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeAuthReturnUrl(url);
  if (!normalized) {
    clearAuthReturnUrl();
    return;
  }
  try {
    window.sessionStorage.setItem(
      AUTH_RETURN_URL_KEY,
      JSON.stringify({ url: normalized, at: Date.now() }),
    );
  } catch {
    // ignore
  }
}

export function readAuthReturnUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(AUTH_RETURN_URL_KEY);
    if (!raw || !raw.trim()) return null;
    // Back-compat: older values may be a plain string.
    if (!raw.trim().startsWith("{")) {
      const normalized = normalizeAuthReturnUrl(raw.trim());
      if (!normalized) {
        clearAuthReturnUrl();
        return null;
      }
      return normalized;
    }
    const parsed = JSON.parse(raw) as { url?: unknown; at?: unknown };
    const url = typeof parsed?.url === "string" ? parsed.url.trim() : "";
    const at = typeof parsed?.at === "number" ? parsed.at : 0;
    if (!url) return null;
    if (at && Date.now() - at > AUTH_RETURN_URL_TTL_MS) {
      clearAuthReturnUrl();
      return null;
    }
    const normalized = normalizeAuthReturnUrl(url);
    if (!normalized) {
      clearAuthReturnUrl();
      return null;
    }
    return normalized;
  } catch {
    clearAuthReturnUrl();
    return null;
  }
}

export function clearAuthReturnUrl(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(AUTH_RETURN_URL_KEY);
  } catch {
    // ignore
  }
}
