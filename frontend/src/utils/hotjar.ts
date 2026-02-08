/* eslint-disable @typescript-eslint/no-explicit-any */

// Hotjar helper (SPA-safe).
//
// Note (2026): Hotjar tracking can be delivered either via legacy Hotjar snippet
// (static.hotjar.com) or via Contentsquare tag (t.contentsquare.net/uxa/*).
// We support both to avoid chasing dashboard changes.
//
// Legacy Hotjar docs:
// - Identify: hj('identify', userId, attributes)
// - Events: hj('event', eventName)
// - State changes (SPA): hj('stateChange', path)
//
// Contentsquare docs:
// - Page events: window._uxa.push(["trackPageEvent", "name"])
// - SPA pageviews: window._uxa.push(["trackPageview", path])

declare global {
  interface Window {
    hj?: (...args: any[]) => void;
    _hjSettings?: { hjid: number; hjsv: number };
    _uxa?: any[];
    CS_CONF?: unknown;
  }
}

const isProdBuild = process.env.NODE_ENV === "production";

const hotjarEnabledFlag = (process.env.REACT_APP_HOTJAR_ENABLED || "").trim();
const trackAllFlag = (process.env.REACT_APP_UX_TRACK_ALL || "").trim();
const trackAll =
  trackAllFlag === "1" ||
  trackAllFlag.toLowerCase() === "true" ||
  trackAllFlag.toLowerCase() === "yes";

const hotjarIdRaw = (process.env.REACT_APP_HOTJAR_ID || "").trim(); // legacy numeric
const hotjarSnippetVersionRaw = (process.env.REACT_APP_HOTJAR_SNIPPET_VERSION || "").trim();

const contentsquareTagIdRaw = (process.env.REACT_APP_CONTENTSQUARE_TAG_ID || "").trim();

const hotjarId = Number(hotjarIdRaw);
const hotjarSnippetVersion = Number(hotjarSnippetVersionRaw || "6");
const hotjarEnabled =
  // Default: enabled in prod when ID is present.
  // Set REACT_APP_HOTJAR_ENABLED=0 to hard-disable.
  hotjarEnabledFlag !== "0";

let initialized = false;
let contentsquareInitialHandled = false;
let cachedDetectedContentsquareTagId: string | null | undefined = undefined;
let lastTrackedPath = "";

type TrackingProvider = "hotjar" | "contentsquare" | "none";

function detectContentsquareTagIdFromDom(): string | null {
  if (typeof document === "undefined") return null;
  const scripts = Array.from(document.scripts || []);
  for (const script of scripts) {
    const src = typeof script.src === "string" ? script.src : "";
    if (!src) continue;
    if (!src.includes("t.contentsquare.net/uxa/")) continue;
    const match = src.match(/\/uxa\/([a-zA-Z0-9]+)\.js(?:\?|$)/);
    if (match?.[1]) return match[1];
  }
  return null;
}

function getContentsquareTagId(): string | null {
  if (contentsquareTagIdRaw) return contentsquareTagIdRaw;
  if (cachedDetectedContentsquareTagId !== undefined) return cachedDetectedContentsquareTagId;
  cachedDetectedContentsquareTagId = detectContentsquareTagIdFromDom();
  return cachedDetectedContentsquareTagId;
}

function hasContentsquareInstalled(): boolean {
  if (typeof window !== "undefined") {
    if (Array.isArray(window._uxa)) return true;
    if (typeof window.CS_CONF !== "undefined") return true;
  }
  if (typeof document !== "undefined") {
    return Boolean(document.querySelector('script[src*="t.contentsquare.net/uxa/"]'));
  }
  return false;
}

function resolveProvider(): TrackingProvider {
  if (!hotjarEnabled) return "none";
  if (!isProdBuild) return "none";

  // Prefer Contentsquare tag when present (this is what Hotjar may provide now).
  if (getContentsquareTagId() || hasContentsquareInstalled()) return "contentsquare";

  // Fallback to legacy Hotjar snippet.
  if (!Number.isFinite(hotjarId) || hotjarId <= 0) return "none";
  if (!Number.isFinite(hotjarSnippetVersion) || hotjarSnippetVersion <= 0) return "none";
  return "hotjar";
}

function isValidTrackingConfig(): boolean {
  if (!hotjarEnabled) return false;
  if (!isProdBuild) return false;
  return resolveProvider() !== "none";
}

export function isHotjarEnabled(): boolean {
  return isValidTrackingConfig();
}

function normalizePath(path: string): string {
  const trimmed = (path || "").trim();
  if (!trimmed) return "/";
  // Only keep pathname to avoid leaking tokens/session ids via query strings into 3rd parties.
  const withoutHash = trimmed.split("#")[0] || "";
  const withoutQuery = withoutHash.split("?")[0] || "";
  return withoutQuery || "/";
}

function ensureHotjarStub(): void {
  if (typeof window === "undefined") return;
  if (typeof window.hj === "function") return;

  // Create a queueing stub so calls made before script load are not lost.
  window.hj = function () {
    (window.hj as any).q = (window.hj as any).q || [];
    (window.hj as any).q.push(arguments);
  };
}

function injectHotjarScript(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  ensureHotjarStub();

  // Avoid double-injecting.
  if (document.querySelector(`script[data-hotjar="true"][data-hjid="${hotjarId}"]`)) {
    return;
  }

  window._hjSettings = { hjid: hotjarId, hjsv: hotjarSnippetVersion };

  const script = document.createElement("script");
  script.async = true;
  script.setAttribute("data-hotjar", "true");
  script.setAttribute("data-hjid", String(hotjarId));
  script.src = `https://static.hotjar.com/c/hotjar-${hotjarId}.js?sv=${hotjarSnippetVersion}`;

  document.head.appendChild(script);
}

function ensureContentsquareStub(): void {
  if (typeof window === "undefined") return;
  window._uxa = window._uxa || [];
}

function injectContentsquareScript(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const tagId = getContentsquareTagId();
  if (!tagId) return;

  ensureContentsquareStub();

  // Avoid double-injecting.
  const scripts = Array.from(document.scripts || []);
  for (const script of scripts) {
    const src = typeof script.src === "string" ? script.src : "";
    if (!src) continue;
    if (src.includes(`t.contentsquare.net/uxa/${tagId}.js`)) return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.setAttribute("data-contentsquare", "true");
  script.setAttribute("data-cs-tag-id", tagId);
  script.src = `https://t.contentsquare.net/uxa/${tagId}.js`;

  document.head.appendChild(script);
}

function shouldTrackPath(pathname: string): boolean {
  // Never track admin.
  if (pathname.startsWith("/admin")) return false;

  // Optional full coverage (non-admin). Use with care: higher volume/cost and more privacy risk.
  if (trackAll) return true;

  // Default: focus on conversion surfaces (LP/Auth/Plans/Checkout/Upgrades).
  if (pathname === "/") return true;
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/planes")) return true;
  if (pathname.startsWith("/comprar")) return true;
  if (pathname.startsWith("/actualizar-planes")) return true;

  return false;
}

export function hotjarStateChange(path: string): void {
  if (!isHotjarEnabled()) return;
  if (typeof window === "undefined") return;

  const normalizedPath = normalizePath(path);
  if (normalizedPath === lastTrackedPath) return;
  lastTrackedPath = normalizedPath;
  const pathname = normalizedPath;
  if (!shouldTrackPath(pathname)) return;

  try {
    const provider = resolveProvider();
    if (provider === "contentsquare") {
      ensureContentsquareStub();
      const opts = { lifespan: "onNextPageviewOnly" as const };

      // Strict privacy: never send query strings to 3rd parties.
      // Contentsquare provides setPath/setQuery to override URL parts.
      // Docs: Tag API reference (setPath/setQuery/trackPageview).
      window._uxa?.push(["setPath", normalizedPath, opts]);
      window._uxa?.push(["setQuery", "", opts]);

      if (!contentsquareInitialHandled) {
        contentsquareInitialHandled = true;
        // Avoid duplicating the initial pageview if the tag is already installed.
        if (typeof window.CS_CONF === "undefined") {
          // In web context, the tag fires a "natural" pageview on load.
          // setPath/setQuery above will override that first pageview.
          injectContentsquareScript();
        }
        return;
      }

      // Artificial pageview for SPAs (setPath/setQuery above define the URL).
      window._uxa?.push(["trackPageview"]);
      return;
    }

    // Legacy Hotjar.
    ensureHotjarStub();
    injectHotjarScript();
    window.hj?.("stateChange", normalizedPath);
  } catch {
    // noop
  }
}

export function hotjarEvent(eventName: string): void {
  if (!isHotjarEnabled()) return;
  if (typeof window === "undefined") return;
  try {
    const safeName = String(eventName || "")
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80);
    if (!safeName) return;

    const provider = resolveProvider();
    if (provider === "contentsquare") {
      ensureContentsquareStub();
      // Contentsquare Custom Page Events API.
      window._uxa?.push(["trackPageEvent", safeName]);
      return;
    }

    // Legacy Hotjar Events API
    ensureHotjarStub();
    window.hj?.("event", safeName);
  } catch {
    // noop
  }
}

export function hotjarIdentify(userId: string, attributes?: Record<string, unknown>): void {
  if (!isHotjarEnabled()) return;
  if (typeof window === "undefined") return;
  try {
    const provider = resolveProvider();
    if (provider === "contentsquare") {
      // Contentsquare has its own identity APIs; we intentionally no-op here to keep strict privacy by default.
      return;
    }
    window.hj?.("identify", userId, attributes || {});
  } catch {
    // noop
  }
}

function attachGrowthMetricBridge(): void {
  if (typeof window === "undefined") return;

  const handler = (event: Event) => {
    try {
      const detail = (event as CustomEvent).detail as any;
      const metric = typeof detail?.metric === "string" ? detail.metric : "";
      if (!metric) return;

      // Only send high-signal funnel milestones as Hotjar events.
      // These appear in Recordings as "events" and are searchable.
      const allow = new Set<string>([
        "lp_to_register",
        "registration_started",
        "registration_completed",
        "registration_failed",
        "registration_abandoned",
        "checkout_started",
        "checkout_method_selected",
        "checkout_abandoned",
        "payment_success",
        "support_chat_opened",
        "subscription_cancel_started",
        "subscription_cancel_reason_selected",
        "subscription_cancel_confirmed",
        "subscription_cancel_failed",
      ]);
      if (!allow.has(metric)) return;

      hotjarEvent(`bb_${metric}`);
    } catch {
      // noop
    }
  };

  window.addEventListener("bb:growth-metric", handler as any);
}

export function initHotjar(): void {
  if (initialized) return;
  initialized = true;

  if (!isValidTrackingConfig()) return;
  const provider = resolveProvider();
  if (provider === "contentsquare") {
    ensureContentsquareStub();
  } else {
    ensureHotjarStub();
  }
  attachGrowthMetricBridge();

  // Initialize the first "page" for SPAs.
  try {
    hotjarStateChange(`${window.location.pathname}${window.location.search}`);
  } catch {
    // noop
  }
}
