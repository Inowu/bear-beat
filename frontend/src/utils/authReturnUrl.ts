const AUTH_RETURN_URL_KEY = "bb.auth.returnUrl";
const AUTH_RETURN_URL_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export function writeAuthReturnUrl(url: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      AUTH_RETURN_URL_KEY,
      JSON.stringify({ url, at: Date.now() }),
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
    if (!raw.trim().startsWith("{")) return raw.trim();
    const parsed = JSON.parse(raw) as { url?: unknown; at?: unknown };
    const url = typeof parsed?.url === "string" ? parsed.url.trim() : "";
    const at = typeof parsed?.at === "number" ? parsed.at : 0;
    if (!url) return null;
    if (at && Date.now() - at > AUTH_RETURN_URL_TTL_MS) {
      clearAuthReturnUrl();
      return null;
    }
    return url;
  } catch {
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
