const META_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie || "";
  const match = raw.match(
    new RegExp(
      `(?:^|; )${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}=([^;]*)`,
    ),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAgeSeconds = META_COOKIE_MAX_AGE_SECONDS): void {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  // SameSite=Lax keeps this first-party and avoids most breakage.
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function generateFbpValue(): string {
  const ts = Math.floor(Date.now() / 1000);
  const rnd =
    typeof window !== "undefined" && typeof window.crypto?.getRandomValues === "function"
      ? Array.from(window.crypto.getRandomValues(new Uint32Array(2)))
          .map((n) => n.toString(10))
          .join("")
      : `${Math.floor(Math.random() * 1e16)}`;
  return `fb.1.${ts}.${rnd}`;
}

/**
 * Ensure Meta's attribution cookies exist for browser pixel and server-side CAPI.
 * This does NOT fire any tracking events; it's safe to call during bootstrap.
 */
export function ensureMetaAttributionCookies(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // _fbp: Meta's first-party browser identifier.
  if (!readCookie("_fbp")) {
    setCookie("_fbp", generateFbpValue());
  }

  // _fbc: derived from fbclid when present (ad click id).
  const fbclid = new URLSearchParams(window.location.search).get("fbclid")?.trim() ?? "";
  if (fbclid && !readCookie("_fbc")) {
    const ts = Math.floor(Date.now() / 1000);
    setCookie("_fbc", `fb.1.${ts}.${fbclid}`);
  }
}

