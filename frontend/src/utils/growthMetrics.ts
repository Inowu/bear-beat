import { trackCustomEvent } from "./facebookPixel";
import { getAccessToken, parseUserIdFromAuthToken } from "./authStorage";
import { apiBaseUrl } from "./runtimeConfig";

export const GROWTH_METRICS = {
  PAGE_VIEW: "page_view",
  HOME_VIEW: "home_view",
  CTA_PRIMARY_CLICK: "cta_primary_click",
  CTA_SECONDARY_CLICK: "cta_secondary_click",
  CTA_CLICK: "cta_click",
  VIEW_DEMO_CLICK: "view_demo_click",
  DEMO_PLAY_STARTED: "demo_play_started",
  PRICING_VIEW: "pricing_view",
  FAQ_EXPAND: "faq_expand",
  FORM_SUBMIT: "form_submit",
  FORM_ERROR: "form_error",
  AUTH_START: "auth_start",
  AUTH_SUCCESS: "auth_success",
  AUTH_ERROR: "auth_error",
  CHECKOUT_START: "checkout_start",
  CHECKOUT_SUCCESS: "checkout_success",
  CHECKOUT_ERROR: "checkout_error",
  ADMIN_ACTION: "admin_action",
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
  SUBSCRIPTION_CANCEL_STARTED: "subscription_cancel_started",
  SUBSCRIPTION_CANCEL_REASON_SELECTED: "subscription_cancel_reason_selected",
  SUBSCRIPTION_CANCEL_CONFIRMED: "subscription_cancel_confirmed",
  SUBSCRIPTION_CANCEL_FAILED: "subscription_cancel_failed",
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

export interface AnalyticsAttribution {
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
const STORAGE_IDENTIFIED_USER_ID = "bb.analytics.userId";
const STORAGE_PENDING_CHECKOUT_RECOVERY = "bb.analytics.pendingCheckout";

const SESSION_TTL_MS = 30 * 60 * 1000;
const FLUSH_BATCH_SIZE = 20;
const FLUSH_DELAY_MS = 1200;
const RETRY_DELAY_MS = 8000;
const MAX_PERSISTED_EVENTS = 200;
const TEST_UTM_CAMPAIGNS = new Set(["test", "template_preview"]);
const CHECKOUT_ABANDON_WINDOW_MIN_MS = 10 * 60 * 1000;
const CHECKOUT_ABANDON_WINDOW_MAX_MS = 30 * 60 * 1000;

interface PendingCheckoutRecoveryState {
  checkoutId: string;
  startedAt: string;
  sessionId: string;
  visitorId: string;
  userId: number | null;
  planId: number | null;
  method: string | null;
  currency: string | null;
  amount: number | null;
}

export interface PendingCheckoutRecoveryInput {
  planId?: number | null;
  method?: string | null;
  currency?: string | null;
  amount?: number | null;
}

const analyticsCollectUrl = `${apiBaseUrl}/api/analytics/collect`;

let hasLifecycleListeners = false;
let flushTimer: number | null = null;
let flushInFlight = false;
let queuedEvents: AnalyticsEventPayload[] = [];
let lastPageViewFingerprint = "";
let lastPageViewAt = 0;
let analyticsRemoteDisabled = false;
let pendingCheckoutRecoveryState: PendingCheckoutRecoveryState | null = null;
let pendingCheckoutRecoveryTimer: number | null = null;
let pendingCheckoutRecoveryInFlight = false;

const eventCategoryMap: Record<GrowthMetricName, AnalyticsCategory> = {
  [GROWTH_METRICS.PAGE_VIEW]: "navigation",
  [GROWTH_METRICS.HOME_VIEW]: "navigation",
  [GROWTH_METRICS.CTA_PRIMARY_CLICK]: "acquisition",
  [GROWTH_METRICS.CTA_SECONDARY_CLICK]: "acquisition",
  [GROWTH_METRICS.CTA_CLICK]: "acquisition",
  [GROWTH_METRICS.VIEW_DEMO_CLICK]: "engagement",
  [GROWTH_METRICS.DEMO_PLAY_STARTED]: "engagement",
  [GROWTH_METRICS.PRICING_VIEW]: "engagement",
  [GROWTH_METRICS.FAQ_EXPAND]: "engagement",
  [GROWTH_METRICS.FORM_SUBMIT]: "engagement",
  [GROWTH_METRICS.FORM_ERROR]: "engagement",
  [GROWTH_METRICS.AUTH_START]: "activation",
  [GROWTH_METRICS.AUTH_SUCCESS]: "activation",
  [GROWTH_METRICS.AUTH_ERROR]: "activation",
  [GROWTH_METRICS.CHECKOUT_START]: "checkout",
  [GROWTH_METRICS.CHECKOUT_SUCCESS]: "purchase",
  [GROWTH_METRICS.CHECKOUT_ERROR]: "checkout",
  [GROWTH_METRICS.ADMIN_ACTION]: "system",
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
  [GROWTH_METRICS.SUBSCRIPTION_CANCEL_STARTED]: "retention",
  [GROWTH_METRICS.SUBSCRIPTION_CANCEL_REASON_SELECTED]: "retention",
  [GROWTH_METRICS.SUBSCRIPTION_CANCEL_CONFIRMED]: "retention",
  [GROWTH_METRICS.SUBSCRIPTION_CANCEL_FAILED]: "retention",
  [GROWTH_METRICS.FILE_SEARCH_PERFORMED]: "engagement",
  [GROWTH_METRICS.FOLDER_NAVIGATED]: "engagement",
  [GROWTH_METRICS.FILE_PREVIEW_OPENED]: "engagement",
  [GROWTH_METRICS.FILE_DOWNLOAD_ATTEMPTED]: "activation",
  [GROWTH_METRICS.FILE_DOWNLOAD_SUCCEEDED]: "activation",
  [GROWTH_METRICS.FILE_DOWNLOAD_FAILED]: "activation",
  [GROWTH_METRICS.WEB_VITAL_REPORTED]: "system",
};

const normalizePositiveUserId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return null;
};

const normalizePositiveInt = (value: unknown): number | null => {
  const normalized = normalizePositiveUserId(value);
  return normalized === null ? null : normalized;
};

const normalizeCurrencyCode = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return normalized.slice(0, 8);
};

function safeStorageRead(
  storage: Storage | null | undefined,
  key: string,
): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageWrite(
  storage: Storage | null | undefined,
  key: string,
  value: string,
): void {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // noop
  }
}

function safeStorageRemove(
  storage: Storage | null | undefined,
  key: string,
): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // noop
  }
}

function getSafeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getSafeSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
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

let memoryVisitorId: string | null = null;
let memorySessionId: string | null = null;
let memorySessionTs = 0;
let memoryAttribution: AnalyticsAttribution | null = null;
let memoryIdentifiedUserId: number | null = null;

function readStoredIdentifiedUserId(): number | null {
  if (typeof window === "undefined") return memoryIdentifiedUserId;
  const localStorage = getSafeLocalStorage();
  const raw = safeStorageRead(localStorage, STORAGE_IDENTIFIED_USER_ID);
  const parsed = normalizePositiveUserId(raw);
  if (parsed === null) return memoryIdentifiedUserId;
  memoryIdentifiedUserId = parsed;
  return parsed;
}

function persistIdentifiedUserId(userId: number | null): void {
  if (typeof window !== "undefined") {
    const localStorage = getSafeLocalStorage();
    if (userId === null) {
      safeStorageRemove(localStorage, STORAGE_IDENTIFIED_USER_ID);
    } else {
      safeStorageWrite(
        localStorage,
        STORAGE_IDENTIFIED_USER_ID,
        String(userId),
      );
    }
  }
  memoryIdentifiedUserId = userId;
}

function resolveCurrentUserId(): number | null {
  const token = getAccessToken();
  const tokenUserId = parseUserIdFromAuthToken(token);
  const normalizedTokenUserId = normalizePositiveUserId(tokenUserId);
  if (normalizedTokenUserId !== null) {
    if (memoryIdentifiedUserId !== normalizedTokenUserId) {
      persistIdentifiedUserId(normalizedTokenUserId);
    }
    return normalizedTokenUserId;
  }
  if (!token) {
    if (memoryIdentifiedUserId !== null) {
      persistIdentifiedUserId(null);
    }
    return null;
  }
  return readStoredIdentifiedUserId();
}

function normalizePendingCheckoutRecoveryState(
  raw: unknown,
): PendingCheckoutRecoveryState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const checkoutId =
    typeof value.checkoutId === "string" ? value.checkoutId.trim() : "";
  const startedAt =
    typeof value.startedAt === "string" ? value.startedAt.trim() : "";
  if (!checkoutId || !startedAt || Number.isNaN(Date.parse(startedAt))) {
    return null;
  }

  const sessionId =
    typeof value.sessionId === "string" ? value.sessionId.trim() : "";
  const visitorId =
    typeof value.visitorId === "string" ? value.visitorId.trim() : "";
  if (!sessionId || !visitorId) return null;

  return {
    checkoutId: checkoutId.slice(0, 80),
    startedAt: new Date(startedAt).toISOString(),
    sessionId: sessionId.slice(0, 80),
    visitorId: visitorId.slice(0, 80),
    userId: normalizePositiveInt(value.userId),
    planId: normalizePositiveInt(value.planId),
    method:
      typeof value.method === "string" && value.method.trim()
        ? value.method.trim().slice(0, 40)
        : null,
    currency: normalizeCurrencyCode(value.currency),
    amount: isFiniteNumber(value.amount) ? value.amount : null,
  };
}

function readPendingCheckoutRecoveryState(): PendingCheckoutRecoveryState | null {
  if (pendingCheckoutRecoveryState) return pendingCheckoutRecoveryState;
  if (typeof window === "undefined") return null;
  const localStorage = getSafeLocalStorage();
  const raw = safeStorageRead(localStorage, STORAGE_PENDING_CHECKOUT_RECOVERY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizePendingCheckoutRecoveryState(parsed);
    if (!normalized) {
      safeStorageRemove(localStorage, STORAGE_PENDING_CHECKOUT_RECOVERY);
      return null;
    }
    pendingCheckoutRecoveryState = normalized;
    return normalized;
  } catch {
    safeStorageRemove(localStorage, STORAGE_PENDING_CHECKOUT_RECOVERY);
    return null;
  }
}

function persistPendingCheckoutRecoveryState(
  state: PendingCheckoutRecoveryState | null,
): void {
  pendingCheckoutRecoveryState = state;
  if (typeof window === "undefined") return;
  const localStorage = getSafeLocalStorage();
  if (!state) {
    safeStorageRemove(localStorage, STORAGE_PENDING_CHECKOUT_RECOVERY);
    return;
  }
  safeStorageWrite(
    localStorage,
    STORAGE_PENDING_CHECKOUT_RECOVERY,
    JSON.stringify(state),
  );
}

function clearPendingCheckoutRecoveryState(): void {
  persistPendingCheckoutRecoveryState(null);
  if (typeof window === "undefined") return;
  if (pendingCheckoutRecoveryTimer !== null) {
    window.clearTimeout(pendingCheckoutRecoveryTimer);
    pendingCheckoutRecoveryTimer = null;
  }
}

function getCheckoutAbandonReason(elapsedMs: number): string {
  return elapsedMs <= CHECKOUT_ABANDON_WINDOW_MAX_MS
    ? "no_payment_10_30m"
    : "no_payment_over_30m";
}

function schedulePendingCheckoutRecoveryCheck(): void {
  if (typeof window === "undefined") return;
  if (pendingCheckoutRecoveryTimer !== null) {
    window.clearTimeout(pendingCheckoutRecoveryTimer);
    pendingCheckoutRecoveryTimer = null;
  }
  const state = readPendingCheckoutRecoveryState();
  if (!state) return;
  const startedAt = Date.parse(state.startedAt);
  if (!Number.isFinite(startedAt)) {
    clearPendingCheckoutRecoveryState();
    return;
  }

  const elapsedMs = Date.now() - startedAt;
  const delay =
    elapsedMs >= CHECKOUT_ABANDON_WINDOW_MIN_MS
      ? 500
      : CHECKOUT_ABANDON_WINDOW_MIN_MS - elapsedMs + 500;

  pendingCheckoutRecoveryTimer = window.setTimeout(() => {
    pendingCheckoutRecoveryTimer = null;
    evaluatePendingCheckoutRecovery();
  }, Math.max(500, delay));
}

function evaluatePendingCheckoutRecovery(): void {
  if (pendingCheckoutRecoveryInFlight) return;
  pendingCheckoutRecoveryInFlight = true;

  try {
    const state = readPendingCheckoutRecoveryState();
    if (!state) return;
    const startedAt = Date.parse(state.startedAt);
    if (!Number.isFinite(startedAt)) {
      clearPendingCheckoutRecoveryState();
      return;
    }

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs < CHECKOUT_ABANDON_WINDOW_MIN_MS) {
      schedulePendingCheckoutRecoveryCheck();
      return;
    }

    clearPendingCheckoutRecoveryState();
    trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ABANDONED, {
      reason: getCheckoutAbandonReason(elapsedMs),
      method: state.method,
      planId: state.planId,
      currency: state.currency,
      amount: state.amount,
      source: "checkout_recovery",
      flow: "inactivity_window_10_30m",
    });
  } finally {
    pendingCheckoutRecoveryInFlight = false;
  }
}

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "server";
  const localStorage = getSafeLocalStorage();
  const existing = safeStorageRead(localStorage, STORAGE_VISITOR_ID);
  if (existing) return existing;
  if (memoryVisitorId) return memoryVisitorId;
  const visitorId = generateId("v");
  safeStorageWrite(localStorage, STORAGE_VISITOR_ID, visitorId);
  memoryVisitorId = visitorId;
  return visitorId;
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server-session";
  const sessionStorage = getSafeSessionStorage();
  const now = Date.now();
  const existing =
    safeStorageRead(sessionStorage, STORAGE_SESSION_ID) ?? memorySessionId;
  const rawTs = safeStorageRead(sessionStorage, STORAGE_SESSION_TS);
  const lastTs = rawTs ? Number(rawTs) : memorySessionTs || NaN;

  if (existing && Number.isFinite(lastTs) && now - lastTs <= SESSION_TTL_MS) {
    safeStorageWrite(sessionStorage, STORAGE_SESSION_TS, String(now));
    memorySessionId = existing;
    memorySessionTs = now;
    return existing;
  }

  const sessionId = generateId("s");
  safeStorageWrite(sessionStorage, STORAGE_SESSION_ID, sessionId);
  safeStorageWrite(sessionStorage, STORAGE_SESSION_TS, String(now));
  memorySessionId = sessionId;
  memorySessionTs = now;
  return sessionId;
}

function readStoredAttribution(): AnalyticsAttribution | null {
  if (typeof window === "undefined") return null;
  const localStorage = getSafeLocalStorage();
  const raw = safeStorageRead(localStorage, STORAGE_ATTRIBUTION);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnalyticsAttribution;
  } catch {
    return null;
  }
}

export function getGrowthAttribution(): AnalyticsAttribution | null {
  return readStoredAttribution();
}

function persistAttribution(attribution: AnalyticsAttribution | null): void {
  if (typeof window === "undefined") return;
  const localStorage = getSafeLocalStorage();
  if (!attribution) {
    safeStorageRemove(localStorage, STORAGE_ATTRIBUTION);
    memoryAttribution = null;
    return;
  }
  safeStorageWrite(
    localStorage,
    STORAGE_ATTRIBUTION,
    JSON.stringify(attribution),
  );
  memoryAttribution = attribution;
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
    return readStoredAttribution() ?? memoryAttribution;
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

const SENSITIVE_PAYLOAD_KEY =
  /(email|e-mail|phone|password|passwd|passcode|token|authorization|cookie|card|credit|cc|cvv|cvc|iban|routing|address|street|zip|postal|ssn|social)/i;

// Keep this list intentionally small and explicit; add keys as needed when introducing new metrics.
const ALLOWED_PAYLOAD_KEYS = new Set<string>([
  // Navigation
  "pagePath",
  "pageQuery",
  "section",
  "location",
  "route",

  // Acquisition / segmentation
  "id",
  "surface",
  "segment",
  "source",
  "from",

  // Generic events (site-wide)
  "ctaId",
  "formId",
  "field",
  "errorCode",
  "flow",
  "action",
  "entity",
  "success",

  // Funnel / purchase
  "planId",
  "method",
  "currency",
  "currencyDefault",
  "amount",
  "value",
  "sessionId",
  "eventId",

  // Cancellation / retention
  "reasonCode",
  "reasonText",
  "reason",

  // Product usage
  "depth",
  "scope",
  "scopePath",
  "fileType",
  "sizeBytes",
  "skipVerificationGate",
  "delivery",
  "statusCode",
  "queryLength",
  "queryText",
  "totalResults",

  // FAQ / content
  "question",

  // Web Vitals
  "metricName",
  "delta",
  "rating",
  "metricId",
  "navigationType",
  "deviceCategory",
]);

const MAX_METADATA_STRING_LEN_DEFAULT = 240;
const MAX_METADATA_STRING_LEN_REASON = 500;

const normalizeCampaign = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

const isAdminPath = (value: string | null | undefined): boolean =>
  typeof value === "string" &&
  (value === "/admin" || value.startsWith("/admin/"));

const getTrafficFlags = (
  payload: Record<string, unknown>,
  attribution: AnalyticsAttribution | null,
  eventPagePath: string | null,
): { isInternal: boolean; isTestCampaign: boolean } => {
  const section =
    typeof payload.section === "string"
      ? payload.section.trim().toLowerCase()
      : null;
  const route =
    typeof payload.route === "string"
      ? payload.route.trim().toLowerCase()
      : null;
  const explicitInternal = payload.isInternal === true;
  const currentPath =
    typeof window !== "undefined" &&
    typeof window.location?.pathname === "string"
      ? window.location.pathname
      : null;
  const campaign = normalizeCampaign(attribution?.campaign ?? null);
  const isTestCampaign = campaign !== null && TEST_UTM_CAMPAIGNS.has(campaign);

  const isInternal =
    explicitInternal ||
    section === "admin" ||
    route === "admin" ||
    isAdminPath(eventPagePath) ||
    isAdminPath(currentPath) ||
    isTestCampaign;

  return { isInternal, isTestCampaign };
};

function sanitizeMetadataValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const maxLen =
      key === "reason" || key === "reasonText"
        ? MAX_METADATA_STRING_LEN_REASON
        : MAX_METADATA_STRING_LEN_DEFAULT;
    return trimmed.slice(0, maxLen);
  }

  // Avoid storing nested objects/arrays by default (keeps payloads predictable and small).
  return null;
}

function sanitizePayload(
  _metric: GrowthMetricName,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!ALLOWED_PAYLOAD_KEYS.has(key)) continue;
    if (SENSITIVE_PAYLOAD_KEY.test(key)) continue;

    const sanitized = sanitizeMetadataValue(key, value);
    if (sanitized === null || sanitized === undefined) continue;
    safe[key] = sanitized;
  }
  return safe;
}

function buildMetadata(
  metric: GrowthMetricName,
  payload: Record<string, unknown>,
  attribution: AnalyticsAttribution | null,
  pagePath: string | null,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    metric,
    ...sanitizePayload(metric, payload),
  };

  const trafficFlags = getTrafficFlags(payload, attribution, pagePath);
  metadata.isInternal = trafficFlags.isInternal;
  metadata.is_internal = trafficFlags.isInternal;
  metadata.isTestCampaign = trafficFlags.isTestCampaign;
  metadata.trafficClass = trafficFlags.isInternal ? "internal" : "external";

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
    typeof window !== "undefined" ? window.location.href.slice(0, 1000) : null;
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
    userId: resolveCurrentUserId(),
    pagePath,
    pageUrl,
    referrer,
    attribution,
    currency,
    amount,
    metadata: buildMetadata(metric, payload, attribution, pagePath),
  };
}

function loadPendingQueueFromStorage(): void {
  if (typeof window === "undefined") return;
  if (queuedEvents.length > 0) return;
  const localStorage = getSafeLocalStorage();
  const raw = safeStorageRead(localStorage, STORAGE_PENDING_QUEUE);
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
  const localStorage = getSafeLocalStorage();
  if (!queuedEvents.length) {
    safeStorageRemove(localStorage, STORAGE_PENDING_QUEUE);
    return;
  }
  const trimmed = queuedEvents.slice(0, MAX_PERSISTED_EVENTS);
  safeStorageWrite(
    localStorage,
    STORAGE_PENDING_QUEUE,
    JSON.stringify(trimmed),
  );
}

function backfillPendingQueueUserId(
  userId: number,
  sessionId: string,
  visitorId: string,
): void {
  loadPendingQueueFromStorage();
  if (!queuedEvents.length) return;

  let changed = false;
  queuedEvents = queuedEvents.map((event) => {
    if (event.userId !== null && event.userId !== undefined) return event;
    if (event.sessionId !== sessionId && event.visitorId !== visitorId)
      return event;
    changed = true;
    return {
      ...event,
      userId,
    };
  });

  if (changed) {
    persistPendingQueue();
  }
}

function enqueueEvent(event: AnalyticsEventPayload): void {
  loadPendingQueueFromStorage();
  queuedEvents.push(event);
  if (queuedEvents.length > MAX_PERSISTED_EVENTS) {
    queuedEvents = queuedEvents.slice(
      queuedEvents.length - MAX_PERSISTED_EVENTS,
    );
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
    const response = await fetch(analyticsCollectUrl, {
      method: "POST",
      credentials: "omit",
      headers: {
        "content-type": "application/json",
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

export interface GrowthIdentitySnapshot {
  sessionId: string;
  visitorId: string;
  userId: number | null;
}

export function identifyGrowthUser(
  userIdInput?: number | null,
): GrowthIdentitySnapshot {
  const sessionId = getOrCreateSessionId();
  const visitorId = getOrCreateVisitorId();
  const normalizedUserId = normalizePositiveUserId(userIdInput);
  const resolvedUserId = normalizedUserId ?? resolveCurrentUserId();

  if (resolvedUserId !== null) {
    persistIdentifiedUserId(resolvedUserId);
    backfillPendingQueueUserId(resolvedUserId, sessionId, visitorId);
    if (queuedEvents.length) {
      scheduleFlush(250);
    }
  }

  return {
    sessionId,
    visitorId,
    userId: resolvedUserId,
  };
}

export function clearGrowthUserIdentity(): void {
  persistIdentifiedUserId(null);
}

export function registerPendingCheckoutRecovery(
  input: PendingCheckoutRecoveryInput = {},
): void {
  const state: PendingCheckoutRecoveryState = {
    checkoutId: generateId("checkout"),
    startedAt: new Date().toISOString(),
    sessionId: getOrCreateSessionId(),
    visitorId: getOrCreateVisitorId(),
    userId: resolveCurrentUserId(),
    planId: normalizePositiveInt(input.planId),
    method:
      typeof input.method === "string" && input.method.trim()
        ? input.method.trim().slice(0, 40)
        : null,
    currency: normalizeCurrencyCode(input.currency),
    amount: isFiniteNumber(input.amount) ? input.amount : null,
  };

  persistPendingCheckoutRecoveryState(state);
  schedulePendingCheckoutRecoveryCheck();
}

export function markCheckoutPaymentSuccess(): void {
  clearPendingCheckoutRecoveryState();
}

export function initGrowthMetrics(): void {
  if (typeof window === "undefined") return;
  captureAttributionFromLocation();
  ensureLifecycleListeners();
  loadPendingQueueFromStorage();
  schedulePendingCheckoutRecoveryCheck();
  evaluatePendingCheckoutRecovery();
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
  if (
    metric === GROWTH_METRICS.CHECKOUT_SUCCESS ||
    metric === GROWTH_METRICS.PAYMENT_SUCCESS ||
    metric === GROWTH_METRICS.CHECKOUT_ABANDONED
  ) {
    clearPendingCheckoutRecoveryState();
  } else {
    evaluatePendingCheckoutRecovery();
  }

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
    const pendingCheckout = readPendingCheckoutRecoveryState();
    const localStorage = getSafeLocalStorage();
    const sessionStorage = getSafeSessionStorage();
    return {
      apiBaseUrl,
      analyticsCollectUrl,
      remoteDisabled: analyticsRemoteDisabled,
      queuedEvents: queuedEvents.length,
      visitorId:
        safeStorageRead(localStorage, STORAGE_VISITOR_ID) ?? memoryVisitorId,
      sessionId:
        safeStorageRead(sessionStorage, STORAGE_SESSION_ID) ?? memorySessionId,
      userId: readStoredIdentifiedUserId(),
      pendingCheckout,
      lastQueueSample: window.__bbGrowthQueue?.slice(-5) ?? [],
    };
  };
}
