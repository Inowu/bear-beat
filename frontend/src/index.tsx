import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./styles/index.scss";
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
import HomeOrLanding from "./functions/HomeOrLanding";
import NotAuthRoute from "./functions/NotAuthRoute";
import LoginForm from "./components/Auth/LoginForm/LoginForm";
import SignUpForm from "./components/Auth/SignUpForm/SignUpForm";
import ForgotPasswordForm from "./components/Auth/ForgotPasswordForm/ForgotPasswordForm";
import ResetPassword from "./components/Auth/ResetPassword/ResetPassword";
import { SSEProvider } from "react-hooks-sse";
import DownloadContextProvider from "./contexts/DownloadContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { sseEndpoint } from "./utils/runtimeConfig";

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

const Auth = lazy(() => import("./pages/Auth/Auth"));
const Instructions = lazy(() => import("./pages/Instructions/Instructions"));
const Legal = lazy(() => import("./pages/Legal/Legal"));
const MyAccount = lazy(() => import("./pages/MyAccount/MyAccount"));
const Plans = lazy(() => import("./pages/Plans/Plans"));
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

function RouteLoader() {
  return (
    <div
      style={{
        minHeight: "40vh",
        display: "grid",
        placeItems: "center",
        color: "var(--theme-text-muted, #9ca3af)",
        fontWeight: 600,
      }}
      aria-live="polite"
      aria-busy="true"
    >
      Cargando...
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
          { path: "", element: <HomeOrLanding /> },
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
          { path: "planesAdmin", element: withRouteSuspense(<PlanAdmin />) },
          { path: "almacenamiento", element: withRouteSuspense(<Storage />) },
          { path: "catalogo", element: withRouteSuspense(<CatalogStats />) },
          { path: "analitica", element: withRouteSuspense(<AnalyticsDashboard />) },
          { path: "live", element: withRouteSuspense(<LiveAnalytics />) },
          { path: "crm", element: withRouteSuspense(<CrmDashboard />) },
          { path: "historial-descargas", element: withRouteSuspense(<DownloadHistory />) },
          { path: "cupones", element: withRouteSuspense(<Coupons />) },
          { path: "ordenes", element: withRouteSuspense(<Ordens />) },
          { path: "historialCheckout", element: withRouteSuspense(<HistoryCheckout />) },
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
        element: <Navigate to="/" replace />,
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

const scheduleIdleTask = (task: () => Promise<void> | void, timeout = 2000, fallbackDelay = 1200) => {
  if (typeof window === "undefined") return;
  const maybeWindow = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  };
  if (typeof maybeWindow.requestIdleCallback === "function") {
    maybeWindow.requestIdleCallback(() => {
      void task();
    }, { timeout });
    return;
  }
  window.setTimeout(() => {
    void task();
  }, fallbackDelay);
};

const scheduleTrackersInit = () => {
  if (typeof window === "undefined") return;
  scheduleIdleTask(async () => {
    const [facebookPixel, growthMetrics, hotjar] = await Promise.all([
      import("./utils/facebookPixel"),
      loadGrowthMetricsModule(),
      import("./utils/hotjar"),
    ]);
    facebookPixel.initFacebookPixel();
    growthMetrics.initGrowthMetrics();
    hotjar.initHotjar();
  }, 4500, 3500);
};

const scheduleMonitoringInit = () => {
  if (typeof window === "undefined") return;
  scheduleIdleTask(async () => {
    await import("./instrument");
  }, 6500, 4500);
};

const MAIN_BUNDLE_HASH_RE = /\/static\/js\/main\.([a-z0-9]+)\.js/i;
const SHELL_RELOAD_GUARD_KEY = "bb-shell-reload-guard";
const CHUNK_RELOAD_GUARD_KEY = "bb-chunk-reload-guard";

function readMainBundleHash(source: string | null | undefined): string | null {
  if (!source) return null;
  const match = source.match(MAIN_BUNDLE_HASH_RE);
  return match?.[1] ?? null;
}

function getCurrentMainBundleHash(): string | null {
  if (typeof document === "undefined") return null;
  const script = document.querySelector("script[src*='/static/js/main.']");
  const src = script?.getAttribute("src");
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
    normalized.includes("failed to fetch dynamically imported module")
  );
}

function installRuntimeStabilityGuards() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  let shellCheckInFlight = false;
  let lastShellCheck = 0;
  const minShellCheckIntervalMs = 15000;

  const runShellCheck = async () => {
    const now = Date.now();
    if (shellCheckInFlight) return;
    if (now - lastShellCheck < minShellCheckIntervalMs) return;
    lastShellCheck = now;
    shellCheckInFlight = true;

    try {
      const currentHash = getCurrentMainBundleHash();
      const publishedHash = await getPublishedMainBundleHash();
      if (!currentHash || !publishedHash || currentHash === publishedHash) {
        window.sessionStorage.removeItem(SHELL_RELOAD_GUARD_KEY);
        return;
      }

      const guardValue = `${currentHash}->${publishedHash}`;
      if (window.sessionStorage.getItem(SHELL_RELOAD_GUARD_KEY) === guardValue) return;

      window.sessionStorage.setItem(SHELL_RELOAD_GUARD_KEY, guardValue);
      window.location.reload();
    } finally {
      shellCheckInFlight = false;
    }
  };

  const recoverChunkLoad = (reason: unknown) => {
    if (!isChunkLoadError(reason)) return;
    const guardValue = window.location.pathname + window.location.search;
    if (window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) === guardValue) return;
    window.sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, guardValue);
    window.location.reload();
  };

  window.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) {
      void runShellCheck();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void runShellCheck();
    }
  });

  window.addEventListener("error", (event) => {
    recoverChunkLoad(event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    recoverChunkLoad(event.reason);
  });

  window.setTimeout(() => {
    void runShellCheck();
  }, 1200);
}

installRuntimeStabilityGuards();

scheduleMonitoringInit();
scheduleTrackersInit();

root.render(
  <React.StrictMode>
    <AppErrorBoundary>
    <ThemeProvider>
      <UserContextProvider>
        <DownloadContextProvider>
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

  void loadGrowthMetricsModule()
    .then((module) => {
      module.trackGrowthMetric(module.GROWTH_METRICS.WEB_VITAL_REPORTED, {
        metricName: metric?.name ?? "unknown",
        value: Number(metricValue.toFixed(4)),
        delta: Number(metricDelta.toFixed(4)),
        rating: metric?.rating ?? "unknown",
        metricId: metric?.id ?? null,
        navigationType: metric?.navigationType ?? null,
        deviceCategory,
        pagePath: window.location.pathname,
      });
    })
    .catch(() => {
      // noop
    });
});
