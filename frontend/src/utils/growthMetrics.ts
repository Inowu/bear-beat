import { trackCustomEvent } from "./facebookPixel";
import { getAccessToken } from "./authStorage";
import { apiBaseUrl } from "./runtimeConfig";

export const GROWTH_METRICS = {
  PAGE_VIEW: "page_view",
  LP_TO_REGISTER: "lp_to_register",
  SEGMENT_SELECTED: "segment_selected",
  LEAD_MAGNET_DOWNLOAD: "lead_magnet_download",
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILED: "login_failed",
  REGISTRATION_STARTED: "registration_started",
  REGISTRATION_COMPLETED: "registration_completed",
  REGISTRATION_FAILED: "registration_failed",
  REGISTRATION_ABANDONED: "registration_abandoned",
  PASSWORD_RECOVERY_REQUESTED: "password_recovery_requested",
  PASSWORD_RECOVERY_FAILED: "password_recovery_failed",
  CHECKOUT_STARTED: "checkout_started",
  CHECKOUT_METHOD_SELECTED: "checkout_method_selected",
  CHECKOUT_ABANDONED: "checkout_abandoned",
  PAYMENT_SUCCESS: "payment_success",
  SUPPORT_CHAT_OPENED: "support_chat_opened",
  FILE_SEARCH_PERFORMED: "file_search_performed",
  FOLDER_NAVIGATED: "folder_navigated",
  FILE_PREVIEW_OPENED: "file_preview_opened",
  FILE_DOWNLOAD_ATTEMPTED: "file_download_attempted",
  FILE_DOWNLOAD_SUCCEEDED: "file_download_succeeded",
  FILE_DOWNLOAD_FAILED: "file_download_failed",
  WEB_VITAL_REPORTED: "web_vital_reported",
} as const;

type GrowthMetricName = (typeof GROWTH_METRICS)[keyof typeof GROWTH_METRICS];

type AnalyticsCategory =
  | "navigation"
  | "acquisition"
  | "engagement"
  | "registration"
  | "checkout"
  | "purchase"
  | "support"
  | "activation"
  | "retention"
  | "system";

interface AnalyticsAttribution {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
}

interface AnalyticsEventPayload {
  eventId: string;
  eventName: string;
  eventCategory: AnalyticsCategory;
  eventTs: string;
  sessionId: string;
  visitorId: string;
  userId: number | null;
  pagePath: string | null;
  pageUrl: string | null;
  referrer: string | null;
  attribution: AnalyticsAttribution | null;
  currency: string | null;
  amount: number | null;
  metadata?: Record<string, unknown>;
}

declare global {
  interface Window {
    __bbGrowthQueue?: Array<Record<string, unknown>>;
    bbAnalyticsStatus?: () => Record<string, unknown>;
    bbAnalyticsFlush?: () => void;
  }
}

const STORAGE_VISITOR_ID = "bb.analytics.visitorId";
const STORAGE_SESSION_ID = "bb.analytics.sessionId";
const STORAGE_SESSION_TS = "bb.analytics.sessionTs";
const STORAGE_ATTRIBUTION = "bb.analytics.attribution";
const STORAGE_PENDING_QUEUE = "bb.analytics.pendingQueue";

const SESSION_TTL_MS = 30 * 60 * 1000;
const FLUSH_BATCH_SIZE = 20;
const FLUSH_DELAY_MS = 1200;
const RETRY_DELAY_MS = 8000;
const MAX_PERSISTED_EVENTS = 200;

const analyticsCollectUrl = `${apiBaseUrl}/api/analytics/collect`;

let hasLifecycleListeners = false;
let flushTimer: number | null = null;
let flushInFlight = false;
let queuedEvents: AnalyticsEventPayload[] = [];
let lastPageViewFingerprint = "";
let lastPageViewAt = 0;
let analyticsRemoteDisabled = false;

const eventCategoryMap: Record<GrowthMetricName, AnalyticsCategory> = {
  [GROWTH_METRICS.PAGE_VIEW]: "navigation",
  [GROWTH_METRICS.LP_TO_REGISTER]: "acquisition",
  [GROWTH_METRICS.SEGMENT_SELECTED]: "engagement",
  [GROWTH_METRICS.LEAD_MAGNET_DOWNLOAD]: "engagement",
  [GROWTH_METRICS.LOGIN_SUCCESS]: "activation",
  [GROWTH_METRICS.LOGIN_FAILED]: "activation",
  [GROWTH_METRICS.REGISTRATION_STARTED]: "registration",
  [GROWTH_METRICS.REGISTRATION_COMPLETED]: "registration",
  [GROWTH_METRICS.REGISTRATION_FAILED]: "registration",
  [GROWTH_METRICS.REGISTRATION_ABANDONED]: "registration",
  [GROWTH_METRICS.PASSWORD_RECOVERY_REQUESTED]: "activation",
  [GROWTH_METRICS.PASSWORD_RECOVERY_FAILED]: "activation",
  [GROWTH_METRICS.CHECKOUT_STARTED]: "checkout",
  [GROWTH_METRICS.CHECKOUT_METHOD_SELECTED]: "checkout",
  [GROWTH_METRICS.CHECKOUT_ABANDONED]: "checkout",
  [GROWTH_METRICS.PAYMENT_SUCCESS]: "purchase",
  [GROWTH_METRICS.SUPPORT_CHAT_OPENED]: "support",
  [GROWTH_METRICS.FILE_SEARCH_PERFORMED]: "engagement",
  [GROWTH_METRICS.FOLDER_NAVIGATED]: "engagement",
  [GROWTH_METRICS.FILE_PREVIEW_OPENED]: "engagement",
  [GROWTH_METRICS.FILE_DOWNLOAD_ATTEMPTED]: "activation",
  [GROWTH_METRICS.FILE_DOWNLOAD_SUCCEEDED]: "activation",
  [GROWTH_METRICS.FILE_DOWNLOAD_FAILED]: "activation",
  [GROWTH_METRICS.WEB_VITAL_REPORTED]: "system",
};

const decodeJwtPayload = (token: string): unknown | null => {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payloadPart = parts[1];
  if (!payloadPart) return null;

  try {
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const json = atob(padded);
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
};

const tryGetUserIdFromToken = (): number | null => {
  if (typeof window === "undefined") return null;
  const token = getAccessToken();
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== "object") return null;

  // Matches backend SessionUser shape (`id` at top-level).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidate = (payload as any).id;
  if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
    return Math.floor(candidate);
  }
  if (typeof candidate === "string") {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  }
  return null;
};

function safeStorageRead(
  storage: Storage,
  key: string,
): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageWrite(
  storage: Storage,
  key: string,
  value: string,
): void {
  try {
    storage.setItem(key, value);
  } catch {
    // noop
  }
}

function safeStorageRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // noop
  }
}

function generateId(prefix: string): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "server";
  const existing = safeStorageRead(window.localStorage, STORAGE_VISITOR_ID);
  if (existing) return existing;
  const visitorId = generateId("v");
  safeStorageWrite(window.localStorage, STORAGE_VISITOR_ID, visitorId);
  return visitorId;
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server-session";
  const now = Date.now();
  const existing = safeStorageRead(window.sessionStorage, STORAGE_SESSION_ID);
  const rawTs = safeStorageRead(window.sessionStorage, STORAGE_SESSION_TS);
  const lastTs = rawTs ? Number(rawTs) : NaN;

  if (existing && Number.isFinite(lastTs) && now - lastTs <= SESSION_TTL_MS) {
    safeStorageWrite(window.sessionStorage, STORAGE_SESSION_TS, String(now));
    return existing;
  }

  const sessionId = generateId("s");
  safeStorageWrite(window.sessionStorage, STORAGE_SESSION_ID, sessionId);
  safeStorageWrite(window.sessionStorage, STORAGE_SESSION_TS, String(now));
  return sessionId;
}

function readStoredAttribution(): AnalyticsAttribution | null {
  if (typeof window === "undefined") return null;
  const raw = safeStorageRead(window.localStorage, STORAGE_ATTRIBUTION);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnalyticsAttribution;
  } catch {
    return null;
  }
}

function persistAttribution(attribution: AnalyticsAttribution | null): void {
  if (typeof window === "undefined") return;
  if (!attribution) {
    safeStorageRemove(window.localStorage, STORAGE_ATTRIBUTION);
    return;
  }
  safeStorageWrite(window.localStorage, STORAGE_ATTRIBUTION, JSON.stringify(attribution));
}

function captureAttributionFromLocation(): AnalyticsAttribution | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const hasAttributionParams =
    params.has("utm_source") ||
    params.has("utm_medium") ||
    params.has("utm_campaign") ||
    params.has("utm_term") ||
    params.has("utm_content") ||
    params.has("fbclid") ||
    params.has("gclid");

  if (!hasAttributionParams) {
    return readStoredAttribution();
  }

  const captured: AnalyticsAttribution = {
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    campaign: params.get("utm_campaign"),
    term: params.get("utm_term"),
    content: params.get("utm_content"),
    fbclid: params.get("fbclid"),
    gclid: params.get("gclid"),
  };

  persistAttribution(captured);
  return captured;
}

function shouldSkipPageViewDuplicate(
  metric: GrowthMetricName,
  payload: Record<string, unknown>,
): boolean {
  if (metric !== GROWTH_METRICS.PAGE_VIEW) return false;
  const path =
    typeof payload.pagePath === "string" && payload.pagePath.trim()
      ? payload.pagePath.trim()
      : typeof window !== "undefined"
        ? window.location.pathname
        : "/";
  const query =
    typeof payload.pageQuery === "string"
      ? payload.pageQuery
      : typeof window !== "undefined"
        ? window.location.search
        : "";
  const fingerprint = `${path}?${query}`;
  const now = Date.now();
  const isDuplicate =
    fingerprint === lastPageViewFingerprint && now - lastPageViewAt < 1000;

  lastPageViewFingerprint = fingerprint;
  lastPageViewAt = now;
  return isDuplicate;
}

function buildMetadata(
  metric: GrowthMetricName,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    metric,
    ...payload,
  };

  if (typeof window !== "undefined") {
    metadata.language = window.navigator.language;
    metadata.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    metadata.viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  return metadata;
}

function buildAnalyticsEvent(
  metric: GrowthMetricName,
  payload: Record<string, unknown>,
): AnalyticsEventPayload {
  const attribution = captureAttributionFromLocation();
  const pagePath =
    typeof payload.pagePath === "string" && payload.pagePath.trim()
      ? payload.pagePath.trim().slice(0, 255)
      : typeof window !== "undefined"
        ? window.location.pathname.slice(0, 255)
        : null;

  const pageUrl =
    typeof window !== "undefined"
      ? window.location.href.slice(0, 1000)
      : null;
  const referrer =
    typeof document !== "undefined" && document.referrer
      ? document.referrer.slice(0, 1000)
      : null;
  const currency =
    typeof payload.currency === "string" && payload.currency.trim()
      ? payload.currency.trim().slice(0, 8)
      : null;
  const amount = isFiniteNumber(payload.amount) ? payload.amount : null;

  return {
    eventId: generateId("evt"),
    eventName: metric,
    eventCategory: eventCategoryMap[metric] ?? "system",
    eventTs: new Date().toISOString(),
    sessionId: getOrCreateSessionId(),
    visitorId: getOrCreateVisitorId(),
    userId: tryGetUserIdFromToken(),
    pagePath,
    pageUrl,
    referrer,
    attribution,
    currency,
    amount,
    metadata: buildMetadata(metric, payload),
  };
}

function loadPendingQueueFromStorage(): void {
  if (typeof window === "undefined") return;
  if (queuedEvents.length > 0) return;
  const raw = safeStorageRead(window.localStorage, STORAGE_PENDING_QUEUE);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as AnalyticsEventPayload[];
    if (Array.isArray(parsed)) {
      queuedEvents = parsed.slice(0, MAX_PERSISTED_EVENTS);
    }
  } catch {
    queuedEvents = [];
  }
}

function persistPendingQueue(): void {
  if (typeof window === "undefined") return;
  if (!queuedEvents.length) {
    safeStorageRemove(window.localStorage, STORAGE_PENDING_QUEUE);
    return;
  }
  const trimmed = queuedEvents.slice(0, MAX_PERSISTED_EVENTS);
  safeStorageWrite(window.localStorage, STORAGE_PENDING_QUEUE, JSON.stringify(trimmed));
}

function enqueueEvent(event: AnalyticsEventPayload): void {
  loadPendingQueueFromStorage();
  queuedEvents.push(event);
  if (queuedEvents.length > MAX_PERSISTED_EVENTS) {
    queuedEvents = queuedEvents.slice(queuedEvents.length - MAX_PERSISTED_EVENTS);
  }
  persistPendingQueue();
}

function scheduleFlush(delay = FLUSH_DELAY_MS): void {
  if (typeof window === "undefined") return;
  if (analyticsRemoteDisabled) return;
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
  }
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushQueuedEvents();
  }, delay);
}

function flushWithBeacon(): void {
  if (typeof window === "undefined") return;
  if (!navigator.sendBeacon) return;
  loadPendingQueueFromStorage();
  if (!queuedEvents.length) return;

  const batch = queuedEvents.slice(0, FLUSH_BATCH_SIZE);
  const blob = new Blob([JSON.stringify({ events: batch })], {
    type: "application/json",
  });
  const sent = navigator.sendBeacon(analyticsCollectUrl, blob);
  if (!sent) return;

  queuedEvents = queuedEvents.slice(batch.length);
  persistPendingQueue();
}

async function flushQueuedEvents(): Promise<void> {
  if (analyticsRemoteDisabled) return;
  if (flushInFlight) return;
  loadPendingQueueFromStorage();
  if (!queuedEvents.length) return;

  flushInFlight = true;
  const batch = queuedEvents.slice(0, FLUSH_BATCH_SIZE);

  try {
    const token = getAccessToken();
    const response = await fetch(analyticsCollectUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(
        `analytics-collect:${response.status}:${bodyText.slice(0, 120)}`,
      );
    }

    const body: unknown = await response.json().catch(() => null);
    // If the backend intentionally skipped analytics (no DB configured), stop retrying.
    if (
      body &&
      typeof body === "object" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (body as any).skipped === true
    ) {
      analyticsRemoteDisabled = true;
      queuedEvents = [];
      persistPendingQueue();
      return;
    }

    queuedEvents = queuedEvents.slice(batch.length);
    persistPendingQueue();
    if (queuedEvents.length) {
      scheduleFlush(250);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isNotFound =
      message.includes("404") ||
      message.includes("NOT_FOUND") ||
      message.includes("analytics-collect:404") ||
      message.includes("analytics-collect:405");

    if (isNotFound) {
      analyticsRemoteDisabled = true;
      queuedEvents = [];
      persistPendingQueue();
      return;
    }

    scheduleFlush(RETRY_DELAY_MS);
  } finally {
    flushInFlight = false;
  }
}

function ensureLifecycleListeners(): void {
  if (typeof window === "undefined" || hasLifecycleListeners) return;
  hasLifecycleListeners = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushWithBeacon();
    }
  });

  window.addEventListener("pagehide", () => {
    flushWithBeacon();
  });

  window.addEventListener("beforeunload", () => {
    flushWithBeacon();
  });
}

export function initGrowthMetrics(): void {
  if (typeof window === "undefined") return;
  captureAttributionFromLocation();
  ensureLifecycleListeners();
  loadPendingQueueFromStorage();
  scheduleFlush(1800);
}

export function flushGrowthMetrics(): void {
  flushWithBeacon();
  void flushQueuedEvents();
}

export function trackGrowthMetric(
  metric: GrowthMetricName,
  payload: Record<string, unknown> = {},
): void {
  if (shouldSkipPageViewDuplicate(metric, payload)) return;

  const detail = {
    metric,
    payload,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      if (!window.__bbGrowthQueue) {
        window.__bbGrowthQueue = [];
      }
      window.__bbGrowthQueue.push(detail);
      window.dispatchEvent(new CustomEvent("bb:growth-metric", { detail }));
    } catch {
      // noop
    }
  }

  trackCustomEvent(`BB_${metric}`, payload);
  ensureLifecycleListeners();
  enqueueEvent(buildAnalyticsEvent(metric, payload));
  scheduleFlush();
}

// Lightweight debug helpers (for QA without needing code changes).
if (typeof window !== "undefined") {
  window.bbAnalyticsFlush = flushGrowthMetrics;
  window.bbAnalyticsStatus = () => {
    loadPendingQueueFromStorage();
    return {
      apiBaseUrl,
      analyticsCollectUrl,
      remoteDisabled: analyticsRemoteDisabled,
      queuedEvents: queuedEvents.length,
      visitorId: safeStorageRead(window.localStorage, STORAGE_VISITOR_ID),
      sessionId: safeStorageRead(window.sessionStorage, STORAGE_SESSION_ID),
      lastQueueSample: window.__bbGrowthQueue?.slice(-5) ?? [],
    };
  };
}
