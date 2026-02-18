const MANYCHAT_ACCOUNT_SCRIPT_SRC = "https://widget.manychat.com/104901938679498.js";
const MANYCHAT_WIDGET_SCRIPT_SRC = "https://mccdn.me/assets/js/widget.js";

const MANYCHAT_ACCOUNT_SCRIPT_ID = "bb-manychat-account-script";
const MANYCHAT_WIDGET_SCRIPT_ID = "bb-manychat-widget-script";
const MANYCHAT_HIDE_STYLE_ID = "bb-manychat-hide-style";
const MANYCHAT_HIDE_CLASS = "bb-hide-manychat-widget";

const SCRIPT_TIMEOUT_MS = 12_000;

const MARKETING_PATHS = new Set<string>([
  "/",
  "/planes",
  "/legal",
]);

let manyChatLoadPromise: Promise<void> | null = null;

type WaitPixelReadyOptions = {
  maxWaitMs: number;
  pollEveryMs?: number;
};

function normalizePath(pathname: string): string {
  const raw = `${pathname ?? ""}`.trim();
  if (!raw) return "/";
  if (raw === "/") return raw;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function isCheckoutPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path.startsWith("/comprar") || path.startsWith("/checkout");
}

function isAuthPath(pathname: string): boolean {
  return normalizePath(pathname).startsWith("/auth");
}

function isAdminPath(pathname: string): boolean {
  return normalizePath(pathname).startsWith("/admin");
}

function isMyAccountPath(pathname: string): boolean {
  return normalizePath(pathname).startsWith("/micuenta");
}

function isManyChatBlockedUiPath(pathname: string): boolean {
  return (
    isCheckoutPath(pathname)
    || isAuthPath(pathname)
    || isAdminPath(pathname)
    || isMyAccountPath(pathname)
  );
}

function ensureManyChatHideStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(MANYCHAT_HIDE_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = MANYCHAT_HIDE_STYLE_ID;
  style.textContent = [
    `body.${MANYCHAT_HIDE_CLASS} iframe[src*="manychat.com"] {`,
    "  display: none !important;",
    "  visibility: hidden !important;",
    "  opacity: 0 !important;",
    "  pointer-events: none !important;",
    "}",
    `body.${MANYCHAT_HIDE_CLASS} iframe[src*="mccdn.me"] {`,
    "  display: none !important;",
    "  visibility: hidden !important;",
    "  opacity: 0 !important;",
    "  pointer-events: none !important;",
    "}",
    `body.${MANYCHAT_HIDE_CLASS} [id*="manychat"],`,
    `body.${MANYCHAT_HIDE_CLASS} [class*="manychat"],`,
    `body.${MANYCHAT_HIDE_CLASS} [id*="mc-widget"],`,
    `body.${MANYCHAT_HIDE_CLASS} [class*="mc-widget"] {`,
    "  display: none !important;",
    "  visibility: hidden !important;",
    "  opacity: 0 !important;",
    "  pointer-events: none !important;",
    "}",
  ].join("\n");

  document.head.appendChild(style);
}

function invokeManyChatApi(methodCandidates: string[]): boolean {
  if (typeof window === "undefined") return false;

  const apis = [
    (window as any).MC_API,
    (window as any).MC_WIDGET,
    (window as any).ManyChatWidget,
  ];

  for (const api of apis) {
    if (!api || typeof api !== "object") continue;

    for (const method of methodCandidates) {
      const fn = (api as any)?.[method];
      if (typeof fn !== "function") continue;
      try {
        fn.call(api);
        return true;
      } catch {
        // noop
      }
    }
  }

  return false;
}

function ensureScript(src: string, scriptId: string): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }

  const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
  let script = existing;

  if (existing && existing.getAttribute("data-bb-loaded") !== "1") {
    const isManagedScript = existing.getAttribute("data-bb-manychat") === "1";
    if (!isManagedScript) {
      // Legacy/static injection fallback: avoid waiting on events we did not register.
      existing.setAttribute("data-bb-loaded", "1");
      return Promise.resolve();
    }

    // Retry path after a timeout/error: recreate managed script node.
    existing.remove();
    script = null;
  }

  if (!script) {
    script = document.createElement("script");
    script.id = scriptId;
    script.src = src;
    script.defer = true;
    script.async = true;
    script.setAttribute("data-bb-manychat", "1");
    document.body.appendChild(script);
  }

  if (script.getAttribute("data-bb-loaded") === "1") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      window.clearTimeout(timeoutId);
    };

    const onLoad = () => {
      if (settled) return;
      settled = true;
      script.setAttribute("data-bb-loaded", "1");
      cleanup();
      resolve();
    };

    const onError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`[MANYCHAT] Failed to load ${src}`));
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`[MANYCHAT] Timed out loading ${src}`));
    }, SCRIPT_TIMEOUT_MS);

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
  });
}

export function isManyChatPixelReady(): boolean {
  return (
    typeof window !== "undefined" &&
    (typeof (window as any).MC_PIXEL?.fireLogConversionEvent === "function" ||
      typeof (window as any).MC_PIXEL?.fireLogMoneyEvent === "function")
  );
}

export function loadManyChatOnce(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }

  if (isManyChatPixelReady()) {
    return Promise.resolve();
  }

  if (manyChatLoadPromise) {
    return manyChatLoadPromise;
  }

  manyChatLoadPromise = (async () => {
    await ensureScript(MANYCHAT_ACCOUNT_SCRIPT_SRC, MANYCHAT_ACCOUNT_SCRIPT_ID);
    await ensureScript(MANYCHAT_WIDGET_SCRIPT_SRC, MANYCHAT_WIDGET_SCRIPT_ID);
  })().catch((error) => {
    manyChatLoadPromise = null;
    throw error;
  });

  return manyChatLoadPromise;
}

// Backward-compatible alias for existing call sites.
export const loadManyChatScriptsOnce = loadManyChatOnce;

export function waitForManyChatPixelReady({
  maxWaitMs,
  pollEveryMs = 120,
}: WaitPixelReadyOptions): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (isManyChatPixelReady()) return Promise.resolve();

  const startedAt = Date.now();

  return new Promise((resolve) => {
    const tick = () => {
      if (isManyChatPixelReady()) {
        resolve();
        return;
      }

      if (Date.now() - startedAt >= maxWaitMs) {
        resolve();
        return;
      }

      window.setTimeout(tick, pollEveryMs);
    };

    window.setTimeout(tick, 0);
  });
}

export function hasManyChatMcpTokenInLocation(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const url = new URL(window.location.href);
    return Boolean((url.searchParams.get("mcp_token") ?? "").trim());
  } catch {
    return false;
  }
}

export function isManyChatMarketingPath(pathname: string): boolean {
  return MARKETING_PATHS.has(normalizePath(pathname));
}

export function shouldLoadManyChatForPath(
  pathname: string,
  forceForAttribution: boolean,
): boolean {
  if (forceForAttribution) return true;

  return isManyChatMarketingPath(pathname);
}

export function syncManyChatWidgetVisibility(pathname: string): void {
  if (typeof document === "undefined") return;

  ensureManyChatHideStyles();

  const shouldHide = isManyChatBlockedUiPath(pathname);
  document.body.classList.toggle(MANYCHAT_HIDE_CLASS, shouldHide);

  if (shouldHide) {
    invokeManyChatApi(["hideWidget", "hide", "close", "minimize"]);
    return;
  }

  invokeManyChatApi(["showWidget", "show"]);
}

export function openManyChatWidget(): boolean {
  if (typeof window !== "undefined" && isManyChatBlockedUiPath(window.location.pathname)) {
    syncManyChatWidgetVisibility(window.location.pathname);
    return false;
  }
  // Try explicit open APIs first, then fall back to show.
  return invokeManyChatApi([
    "openWidget",
    "open",
    "expand",
    "maximize",
    "showWidget",
    "show",
  ]);
}
