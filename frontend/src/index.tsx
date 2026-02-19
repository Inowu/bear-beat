import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./styles/bootstrap-modal-lite.css";
import "./styles/index.scss";
import "sonner/dist/styles.css";
import reportWebVitals from "./reportWebVitals";
import { ErrorFallback } from "./components/ErrorFallback/ErrorFallback";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import UserContextProvider from "./contexts/UserContext";
import AuthRoute from "./functions/AuthRoute";
import LandingOrAuthRoute from "./functions/LandingOrAuthRoute";
import NotAuthRoute from "./functions/NotAuthRoute";
import { SSEProvider } from "react-hooks-sse";
import DownloadContextProvider from "./contexts/DownloadContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { sseEndpoint } from "./utils/runtimeConfig";
import { initManyChatHandoff } from "./utils/manychatHandoff";
import {
  hasManyChatMcpTokenInLocation,
  loadManyChatOnce,
  shouldLoadManyChatForPath,
  syncManyChatWidgetVisibility,
} from "./utils/manychatLoader";
import { bindHotjarStateChange } from "./utils/hotjarBridge";
import { bindGrowthMetricBridge, trackGrowthMetricBridge } from "./utils/growthMetricsBridge";
import { ensureMetaAttributionCookies } from "./utils/metaAttributionCookies";
import { IconContext } from "src/icons";
import { SkeletonTable } from "./components/ui";
import { AppToaster } from "./components/Toast/AppToaster";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      error: error instanceof Error ? error : new Error("Unexpected app error"),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    void import("@sentry/react")
      .then((module) => {
        module.captureException(error, {
          extra: {
            componentStack: errorInfo.componentStack ?? "",
          },
        });
      })
      .catch(() => {
        // noop
      });
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

const HomeOrLanding = lazy(() => import("./functions/HomeOrLanding"));
const Auth = lazy(() => import("./pages/Auth/Auth"));
const Plans = lazy(() => import("./pages/Plans/Plans"));
const LoginForm = lazy(() => import("./components/Auth/LoginForm/LoginForm"));
const SignUpForm = lazy(() => import("./components/Auth/SignUpForm/SignUpForm"));
const ForgotPasswordForm = lazy(() => import("./components/Auth/ForgotPasswordForm/ForgotPasswordForm"));
const ResetPassword = lazy(() => import("./components/Auth/ResetPassword/ResetPassword"));
const Instructions = lazy(() => import("./pages/Instructions/Instructions"));
const Legal = lazy(() => import("./pages/Legal/Legal"));
const NotFound = lazy(() => import("./pages/NotFound/NotFound"));
const MyAccount = lazy(() => import("./pages/MyAccount/MyAccount"));
const Checkout = lazy(() => import("./pages/Checkout/Checkout"));
const CheckoutSuccess = lazy(() => import("./pages/Checkout/CheckoutSuccess"));
const PlanUpgrade = lazy(() =>
  import("./pages/PlanUpgrade/PlanUpgrade").then((module) => ({ default: module.PlanUpgrade })),
);
const Downloads = lazy(() => import("./pages/Downloads/Downloads"));
const Admin = lazy(() => import("./pages/Admin/Admin"));
const PlanAdmin = lazy(() =>
  import("./pages/Admin/PlanAdmin/PlanAdmin").then((module) => ({ default: module.PlanAdmin })),
);
const Storage = lazy(() =>
  import("./pages/Admin/Storage/Storage").then((module) => ({ default: module.Storage })),
);
const CatalogStats = lazy(() =>
  import("./pages/Admin/CatalogStats/CatalogStats").then((module) => ({ default: module.CatalogStats })),
);
const AnalyticsDashboard = lazy(() =>
  import("./pages/Admin/Analytics/AnalyticsDashboard").then((module) => ({ default: module.AnalyticsDashboard })),
);
const LiveAnalytics = lazy(() =>
  import("./pages/Admin/Live/LiveAnalytics").then((module) => ({ default: module.LiveAnalytics })),
);
const CrmDashboard = lazy(() =>
  import("./pages/Admin/Crm/CrmDashboard").then((module) => ({ default: module.CrmDashboard })),
);
const DownloadHistory = lazy(() =>
  import("./pages/Admin/DownloadsHistory/DownloadHistory").then((module) => ({ default: module.DownloadHistory })),
);
const Coupons = lazy(() =>
  import("./pages/Admin/Coupons/Coupons").then((module) => ({ default: module.Coupons })),
);
const Ordens = lazy(() =>
  import("./pages/Admin/Ordens/Ordens").then((module) => ({ default: module.Ordens })),
);
const HistoryCheckout = lazy(() =>
  import("./pages/Admin/HistoryCheckout/HistoryCheckout").then((module) => ({ default: module.HistoryCheckout })),
);
const BlockedEmailDomains = lazy(() =>
  import("./pages/Admin/BlockedEmailDomains/BlockedEmailDomains").then((module) => ({
    default: module.BlockedEmailDomains,
  })),
);
const BlockedPhoneNumbers = lazy(() =>
  import("./pages/Admin/BlockedPhoneNumbers/BlockedPhoneNumbers").then((module) => ({
    default: module.BlockedPhoneNumbers,
  })),
);
const AuditLogs = lazy(() =>
  import("./pages/Admin/AuditLogs/AuditLogs").then((module) => ({ default: module.AuditLogs })),
);
const WebhookInbox = lazy(() =>
  import("./pages/Admin/WebhookInbox/WebhookInbox").then((module) => ({ default: module.WebhookInbox })),
);
const EmailTemplates = lazy(() =>
  import("./pages/Admin/EmailTemplates/EmailTemplates").then((module) => ({
    default: module.EmailTemplates,
  })),
);

function RouteLoader() {
  return (
    <div
      style={{
        minHeight: "40vh",
        display: "grid",
        placeItems: "center",
        width: "min(620px, 100%)",
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="bb-skeleton-shell" role="status">
        <span className="sr-only">Actualizando ruta</span>
        <SkeletonTable />
      </div>
    </div>
  );
}

const withRouteSuspense = (content: React.ReactNode) => (
  <Suspense fallback={<RouteLoader />}>{content}</Suspense>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      {
        path: "",
        element: <LandingOrAuthRoute />,
        children: [
          { path: "", element: withRouteSuspense(<HomeOrLanding />) },
          { path: "instrucciones", element: withRouteSuspense(<Instructions />) },
          { path: "legal", element: withRouteSuspense(<Legal />) },
          {
            path: "micuenta",
            element: (
              <AuthRoute>
                {withRouteSuspense(<MyAccount />)}
              </AuthRoute>
            ),
          },
          {
            path: "descargas",
            element: (
              <AuthRoute>
                {withRouteSuspense(<Downloads />)}
              </AuthRoute>
            ),
          },
          {
            path: "planes",
            element: withRouteSuspense(<Plans />),
          },
          {
            path: "comprar",
            element: (
              <AuthRoute>
                {withRouteSuspense(<Checkout />)}
              </AuthRoute>
            ),
          },
          {
            path: "comprar/success",
            element: (
              <AuthRoute>
                {withRouteSuspense(<CheckoutSuccess />)}
              </AuthRoute>
            ),
          },
          {
            path: "actualizar-planes",
            element: (
              <AuthRoute>
                {withRouteSuspense(<PlanUpgrade />)}
              </AuthRoute>
            ),
          },
        ],
      },
      {
        path: "admin",
        element: (
          <AuthRoute>
            <Outlet />
          </AuthRoute>
        ),
        children: [
          { path: "", element: <Navigate replace to="usuarios" /> },
          { path: "usuarios", element: withRouteSuspense(<Admin />) },
          { path: "planes", element: withRouteSuspense(<PlanAdmin />) },
          { path: "planesAdmin", element: <Navigate replace to="/admin/planes" /> },
          { path: "almacenamiento", element: withRouteSuspense(<Storage />) },
          { path: "catalogo", element: withRouteSuspense(<CatalogStats />) },
          { path: "analytics", element: <Navigate replace to="/admin/analitica" /> },
          { path: "analitica", element: withRouteSuspense(<AnalyticsDashboard />) },
          { path: "live", element: withRouteSuspense(<LiveAnalytics />) },
          { path: "crm", element: withRouteSuspense(<CrmDashboard />) },
          { path: "historial-descargas", element: withRouteSuspense(<DownloadHistory />) },
          { path: "cupones", element: withRouteSuspense(<Coupons />) },
          { path: "ordenes", element: withRouteSuspense(<Ordens />) },
          { path: "historial-checkout", element: withRouteSuspense(<HistoryCheckout />) },
          { path: "historialCheckout", element: <Navigate replace to="/admin/historial-checkout" /> },
          { path: "audit-logs", element: withRouteSuspense(<AuditLogs />) },
          { path: "webhook-inbox", element: withRouteSuspense(<WebhookInbox />) },
          { path: "email-templates", element: withRouteSuspense(<EmailTemplates />) },
          { path: "dominios-bloqueados", element: withRouteSuspense(<BlockedEmailDomains />) },
          { path: "telefonos-bloqueados", element: withRouteSuspense(<BlockedPhoneNumbers />) },
        ],
      },
      {
        path: "auth",
        element: (
          <NotAuthRoute>
            {withRouteSuspense(<Auth />)}
          </NotAuthRoute>
        ),
        children: [
          { path: "", element: withRouteSuspense(<LoginForm />) },
          { path: "registro", element: withRouteSuspense(<SignUpForm />) },
          { path: "recuperar", element: withRouteSuspense(<ForgotPasswordForm />) },
          { path: "reset-password", element: withRouteSuspense(<ResetPassword />) },
        ],
      },
      {
        path: "*",
        element: withRouteSuspense(<NotFound />),
      },
    ],
  },
]);

let growthMetricsModulePromise: Promise<typeof import("./utils/growthMetrics")> | null = null;

function loadGrowthMetricsModule() {
  if (!growthMetricsModulePromise) {
    growthMetricsModulePromise = import("./utils/growthMetrics");
  }
  return growthMetricsModulePromise;
}

const scheduleIdleTask = (task: () => Promise<void> | void, minDelayMs = 1200, idleTimeoutMs = 2000) => {
  if (typeof window === "undefined") return;
  // We want a *minimum* delay to protect first paint; requestIdleCallback's timeout
  // is a *maximum* delay, so we gate it behind a real timer.
  window.setTimeout(() => {
    const maybeWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    };
    if (typeof maybeWindow.requestIdleCallback === "function") {
      maybeWindow.requestIdleCallback(() => {
        void task();
      }, { timeout: idleTimeoutMs });
      return;
    }
    void task();
  }, minDelayMs);
};

const scheduleTrackersInit = (gate?: Promise<void> | null) => {
  if (typeof window === "undefined") return;
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const minDelayMs = isMobile ? 6500 : 3000;
  const idleTimeoutMs = isMobile ? 4500 : 2500;

  let initPromise: Promise<void> | null = null;
  const initOnce = () => {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (gate) {
        try {
          await gate;
        } catch {
          // noop
        }
      }
      const [facebookPixel, growthMetrics, hotjar] = await Promise.all([
        import("./utils/facebookPixel"),
        loadGrowthMetricsModule(),
        import("./utils/hotjar"),
      ]);

      facebookPixel.initFacebookPixel();

      growthMetrics.initGrowthMetrics();
      bindGrowthMetricBridge((metric, payload) => {
        growthMetrics.trackGrowthMetric(metric as any, payload);
      });

      hotjar.initHotjar();
      bindHotjarStateChange(hotjar.hotjarStateChange);

      // SPA support: fire PageView on route changes after pixel is initialized.
      try {
        let lastKey = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        router.subscribe((state: any) => {
          const loc = state?.location;
          if (!loc) return;
          const nextKey = `${loc.pathname ?? ""}${loc.search ?? ""}${loc.hash ?? ""}`;
          if (!nextKey || nextKey === lastKey) return;
          lastKey = nextKey;
          facebookPixel.trackPageView();
        });
      } catch {
        // noop
      }
    })().catch(() => {
      // Best-effort: don't break the app if a tracker fails.
    });

    return initPromise;
  };

  const startOnInteraction = () => {
    scheduleIdleTask(initOnce, 0, idleTimeoutMs);
  };

  // Load earlier if the user shows intent (avoid missing short sessions),
  // otherwise wait for the fallback delay to protect first paint.
  window.addEventListener("pointerdown", startOnInteraction, { once: true, passive: true });
  window.addEventListener("keydown", startOnInteraction, { once: true });
  scheduleIdleTask(initOnce, minDelayMs, idleTimeoutMs);
};

const scheduleManyChatBootstrap = () => {
  if (typeof window === "undefined") return;

  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const minDelayMs = isMobile ? 5600 : 2600;
  const idleTimeoutMs = isMobile ? 4200 : 2600;

  const maybeLoadManyChat = () => {
    const pathname = window.location.pathname;
    const hasMcpToken = hasManyChatMcpTokenInLocation();

    syncManyChatWidgetVisibility(pathname);

    if (!shouldLoadManyChatForPath(pathname, hasMcpToken)) return;
    void loadManyChatOnce().catch(() => {
      // noop
    });
  };

  // Keep checkout clean even if the scripts were loaded on a previous route.
  syncManyChatWidgetVisibility(window.location.pathname);

  if (hasManyChatMcpTokenInLocation()) {
    // Attribution-sensitive path: load immediately when mcp_token exists.
    maybeLoadManyChat();
  } else {
    // Marketing routes load lazily to protect first paint and reduce checkout distractions.
    const startOnInteraction = () => {
      scheduleIdleTask(maybeLoadManyChat, 0, idleTimeoutMs);
    };

    window.addEventListener("pointerdown", startOnInteraction, { once: true, passive: true });
    window.addEventListener("keydown", startOnInteraction, { once: true });
    scheduleIdleTask(maybeLoadManyChat, minDelayMs, idleTimeoutMs);
  }

  let lastRouteKey = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  router.subscribe((state: any) => {
    const loc = state?.location;
    const pathname =
      typeof loc?.pathname === "string" ? loc.pathname : window.location.pathname;
    const search = typeof loc?.search === "string" ? loc.search : window.location.search;
    const hash = typeof loc?.hash === "string" ? loc.hash : window.location.hash;
    const nextKey = `${pathname}${search}${hash}`;
    if (!nextKey || nextKey === lastRouteKey) return;
    lastRouteKey = nextKey;

    syncManyChatWidgetVisibility(pathname);

    const hasMcpToken = hasManyChatMcpTokenInLocation();
    if (!shouldLoadManyChatForPath(pathname, hasMcpToken)) return;
    void loadManyChatOnce().catch(() => {
      // noop
    });
  });
};

const scheduleMonitoringInit = () => {
  if (typeof window === "undefined") return;
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const minDelayMs = isMobile ? 12_000 : 6500;
  const idleTimeoutMs = isMobile ? 6000 : 4500;

  scheduleIdleTask(async () => {
    await import("./instrument");
  }, minDelayMs, idleTimeoutMs);
};

// Vite's chunk hash can be base64url-ish (`A-Z a-z 0-9 _ -`), not only hex.
const MAIN_BUNDLE_HASH_RE = /(?:\/static\/js\/main\.|\/assets\/index-)([a-z0-9_-]+)\.(?:js|mjs)/i;
const CSS_CHUNK_RE = /(?:\/static\/css\/.+\.css|\/assets\/.+\.css)/i;
const SHELL_RELOAD_GUARD_KEY = "bb-shell-reload-guard";
const CHUNK_RELOAD_GUARD_KEY = "bb-chunk-reload-guard";
const CSS_CHUNK_RELOAD_GUARD_KEY = "bb-css-chunk-reload-guard";
const runtimeSessionFallback = new Map<string, string>();

function safeRuntimeSessionGet(key: string): string | null {
  if (typeof window === "undefined") return runtimeSessionFallback.get(key) ?? null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return runtimeSessionFallback.get(key) ?? null;
  }
}

function safeRuntimeSessionSet(key: string, value: string): void {
  runtimeSessionFallback.set(key, value);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // noop
  }
}

function safeRuntimeSessionRemove(key: string): void {
  runtimeSessionFallback.delete(key);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // noop
  }
}

function readMainBundleHash(source: string | null | undefined): string | null {
  if (!source) return null;
  const match = source.match(MAIN_BUNDLE_HASH_RE);
  return match?.[1] ?? null;
}

function getCurrentMainBundleHash(): string | null {
  if (typeof document === "undefined") return null;
  const script = (
    document.querySelector("script[src*='/static/js/main.']") ||
    document.querySelector("script[src*='/assets/index-'][type='module']") ||
    document.querySelector("script[src*='/assets/index-']")
  ) as HTMLScriptElement | null;
  const src = script?.getAttribute("src") || script?.src;
  return readMainBundleHash(src);
}

async function getPublishedMainBundleHash(): Promise<string | null> {
  try {
    const res = await fetch(`/?bb_shell_check=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return readMainBundleHash(html);
  } catch {
    return null;
  }
}

function isChunkLoadError(reason: unknown): boolean {
  const text =
    reason instanceof Error
      ? `${reason.name} ${reason.message}`
      : `${reason ?? ""}`;
  const normalized = text.toLowerCase();
  return (
    normalized.includes("chunkloaderror") ||
    normalized.includes("loading chunk") ||
    normalized.includes("css chunk load failed") ||
    normalized.includes("failed to fetch dynamically imported module") ||
    normalized.includes("importing a module script failed") ||
    normalized.includes("text/html") ||
    normalized.includes("mime type") ||
    normalized.includes("unexpected token '<'")
  );
}

function unregisterLegacyServiceWorkers() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      if (!registrations.length) return;
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    })
    .catch(() => {
      // noop
    });
}

function installRuntimeStabilityGuards() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  let shellCheckInFlight = false;
  let lastShellCheck = 0;
  const minShellCheckIntervalMs = 15000;

  const runShellCheck = async (force = false) => {
    const now = Date.now();
    if (shellCheckInFlight) return;
    if (!force && now - lastShellCheck < minShellCheckIntervalMs) return;
    lastShellCheck = now;
    shellCheckInFlight = true;

    try {
      const currentHash = getCurrentMainBundleHash();
      const publishedHash = await getPublishedMainBundleHash();
      if (!currentHash || !publishedHash || currentHash === publishedHash) {
        safeRuntimeSessionRemove(SHELL_RELOAD_GUARD_KEY);
        return;
      }

      const guardValue = `${currentHash}->${publishedHash}`;
      if (safeRuntimeSessionGet(SHELL_RELOAD_GUARD_KEY) === guardValue) return;

      safeRuntimeSessionSet(SHELL_RELOAD_GUARD_KEY, guardValue);
      window.location.reload();
    } finally {
      shellCheckInFlight = false;
    }
  };

  const recoverChunkLoad = (reason: unknown) => {
    if (!isChunkLoadError(reason)) return;
    const guardValue = window.location.pathname + window.location.search;
    if (safeRuntimeSessionGet(CHUNK_RELOAD_GUARD_KEY) === guardValue) return;
    safeRuntimeSessionSet(CHUNK_RELOAD_GUARD_KEY, guardValue);
    window.location.reload();
  };

  const recoverStylesheetLoad = (target: EventTarget | null, reason: unknown) => {
    const link = target instanceof HTMLLinkElement ? target : null;
    const href = link?.href ?? "";
    const reasonText = `${reason ?? ""}`.toLowerCase();
    const looksLikeCssChunkError =
      reasonText.includes("css chunk load failed") ||
      reasonText.includes("loading css chunk");
    const looksLikeRuntimeStylesheet = Boolean(href && CSS_CHUNK_RE.test(href));
    if (!looksLikeCssChunkError && !looksLikeRuntimeStylesheet) return;

    const guardValue = href || `${window.location.pathname}${window.location.search}`;
    if (safeRuntimeSessionGet(CSS_CHUNK_RELOAD_GUARD_KEY) === guardValue) return;
    safeRuntimeSessionSet(CSS_CHUNK_RELOAD_GUARD_KEY, guardValue);
    window.location.reload();
  };

  window.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) {
      void runShellCheck(true);
    }
  });

  window.addEventListener("focus", () => {
    void runShellCheck(true);
  });

  window.addEventListener("popstate", () => {
    void runShellCheck(true);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void runShellCheck(true);
    }
  });

  window.addEventListener("error", (event) => {
    recoverChunkLoad(event.error ?? event.message);
    recoverStylesheetLoad(event.target ?? null, event.error ?? event.message);
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    recoverChunkLoad(event.reason);
    recoverStylesheetLoad(null, event.reason);
  });

  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args as Parameters<History["pushState"]>);
    void runShellCheck(true);
    return result;
  };

  window.history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args as Parameters<History["replaceState"]>);
    void runShellCheck(true);
    return result;
  };

  window.setTimeout(() => {
    void runShellCheck();
  }, 1200);

  window.setInterval(() => {
    void runShellCheck();
  }, 30000);
}

unregisterLegacyServiceWorkers();
installRuntimeStabilityGuards();

// Ensure `_fbp/_fbc` exist early so checkout + server-side CAPI can always attach attribution,
// even when tracker init is delayed for performance.
ensureMetaAttributionCookies();

scheduleManyChatBootstrap();

// Capture ManyChat handoff params ASAP. If `mcp_token` is present, we temporarily keep it so
// ManyChat can read it, then strip it before initializing other trackers.
const trackersGate = initManyChatHandoff();

scheduleMonitoringInit();
scheduleTrackersInit(trackersGate);

root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <IconContext.Provider value={{ color: "currentColor", size: "1em", weight: "regular" }}>
        <ThemeProvider>
          <UserContextProvider>
            <DownloadContextProvider>
              <AppToaster />
              {sseEndpoint ? (
                <SSEProvider endpoint={sseEndpoint}>
                  <RouterProvider router={router} />
                </SSEProvider>
              ) : (
                <RouterProvider router={router} />
              )}
            </DownloadContextProvider>
          </UserContextProvider>
        </ThemeProvider>
      </IconContext.Provider>
    </AppErrorBoundary>
  </React.StrictMode>
);

reportWebVitals((metric: any) => {
  if (typeof window === "undefined") return;
  const metricValue =
    typeof metric?.value === "number" && Number.isFinite(metric.value)
      ? metric.value
      : 0;
  const metricDelta =
    typeof metric?.delta === "number" && Number.isFinite(metric.delta)
      ? metric.delta
      : 0;
  const deviceCategory = window.matchMedia("(max-width: 768px)").matches
    ? "mobile"
    : "desktop";

  trackGrowthMetricBridge("web_vital_reported", {
    metricName: metric?.name ?? "unknown",
    value: Number(metricValue.toFixed(4)),
    delta: Number(metricDelta.toFixed(4)),
    rating: metric?.rating ?? "unknown",
    metricId: metric?.id ?? null,
    navigationType: metric?.navigationType ?? null,
    deviceCategory,
    pagePath: window.location.pathname,
  });
});
