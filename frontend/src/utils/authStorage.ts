import { trackGrowthMetricBridge } from "./growthMetricsBridge";

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const ADMIN_ACCESS_BACKUP_KEY = "isAdminAccess";
const STORAGE_UNAVAILABLE_METRIC = "auth_storage_unavailable";

interface JwtPayloadWithId {
  id?: unknown;
}

type StorageScope = "session" | "local";
type StorageOperation = "access" | "read" | "write" | "remove";

export interface AdminAccessBackup {
  adminToken: string;
  adminRefreshToken: string;
}

const memoryStore = new Map<string, string>();
const storageWarningDedupe = new Set<string>();

function decodeJwtPayload(token: string): JwtPayloadWithId | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payloadPart = parts[1];
  if (!payloadPart || typeof atob !== "function") return null;

  try {
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(atob(padded)) as unknown;
    if (!payload || typeof payload !== "object") return null;
    return payload as JwtPayloadWithId;
  } catch {
    return null;
  }
}

export function parseUserIdFromAuthToken(
  token: string | null | undefined,
): number | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const candidate = payload.id;
  if (
    typeof candidate === "number" &&
    Number.isFinite(candidate) &&
    candidate > 0
  ) {
    return Math.floor(candidate);
  }
  if (typeof candidate === "string") {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return null;
}

function reportStorageUnavailable(
  scope: StorageScope,
  operation: StorageOperation,
  error?: unknown,
): void {
  if (typeof window === "undefined") return;
  const dedupeKey = `${scope}:${operation}`;
  if (storageWarningDedupe.has(dedupeKey)) return;
  storageWarningDedupe.add(dedupeKey);

  const reason =
    error instanceof Error && error.name ? error.name : "storage_unavailable";
  const payload = {
    storage: scope,
    operation,
    fallback: "memory_or_local",
    reason,
  };

  trackGrowthMetricBridge(STORAGE_UNAVAILABLE_METRIC, payload);

  // Best-effort warning in Sentry (without blocking auth flow).
  void import("@sentry/react")
    .then((module) => {
      module.captureMessage(STORAGE_UNAVAILABLE_METRIC, {
        level: "warning",
        tags: {
          event_name: STORAGE_UNAVAILABLE_METRIC,
          storage_scope: scope,
          storage_operation: operation,
        },
        extra: payload,
      });
    })
    .catch(() => {
      // noop
    });
}

function getStorage(scope: StorageScope): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return scope === "session" ? window.sessionStorage : window.localStorage;
  } catch (error) {
    reportStorageUnavailable(scope, "access", error);
    return null;
  }
}

function safeGet(
  storage: Storage | null,
  key: string,
  scope: StorageScope,
): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch (error) {
    reportStorageUnavailable(scope, "read", error);
    return null;
  }
}

function safeSet(
  storage: Storage | null,
  key: string,
  value: string,
  scope: StorageScope,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    reportStorageUnavailable(scope, "write", error);
    return false;
  }
}

function safeRemove(
  storage: Storage | null,
  key: string,
  scope: StorageScope,
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    reportStorageUnavailable(scope, "remove", error);
    return false;
  }
}

function readTokenWithMigration(key: string): string | null {
  if (typeof window === "undefined") return null;
  const sessionStorage = getStorage("session");
  const localStorage = getStorage("local");

  const fromSession = safeGet(sessionStorage, key, "session");
  if (fromSession) {
    memoryStore.set(key, fromSession);
    return fromSession;
  }

  const fromMemory = memoryStore.get(key);
  if (fromMemory) {
    return fromMemory;
  }

  // Backward compatibility: migrate token from localStorage to sessionStorage once.
  const fromLocal = safeGet(localStorage, key, "local");
  if (fromLocal) {
    memoryStore.set(key, fromLocal);
    const migrated = safeSet(sessionStorage, key, fromLocal, "session");
    if (migrated) {
      safeRemove(localStorage, key, "local");
    }
    return fromLocal;
  }

  return null;
}

export function getAccessToken(): string | null {
  return readTokenWithMigration(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return readTokenWithMigration(REFRESH_TOKEN_KEY);
}

export function setAuthTokens(token: string, refreshToken: string): void {
  if (typeof window === "undefined") return;
  const sessionStorage = getStorage("session");
  const localStorage = getStorage("local");

  memoryStore.set(ACCESS_TOKEN_KEY, token);
  memoryStore.set(REFRESH_TOKEN_KEY, refreshToken);

  const tokenInSession = safeSet(
    sessionStorage,
    ACCESS_TOKEN_KEY,
    token,
    "session",
  );
  const refreshInSession = safeSet(
    sessionStorage,
    REFRESH_TOKEN_KEY,
    refreshToken,
    "session",
  );

  if (tokenInSession && refreshInSession) {
    safeRemove(localStorage, ACCESS_TOKEN_KEY, "local");
    safeRemove(localStorage, REFRESH_TOKEN_KEY, "local");
    return;
  }

  // Fallback persistence for browsers where sessionStorage is blocked.
  safeSet(localStorage, ACCESS_TOKEN_KEY, token, "local");
  safeSet(localStorage, REFRESH_TOKEN_KEY, refreshToken, "local");
}

export function clearAuthTokens(): void {
  if (typeof window === "undefined") return;
  const sessionStorage = getStorage("session");
  const localStorage = getStorage("local");

  memoryStore.delete(ACCESS_TOKEN_KEY);
  memoryStore.delete(REFRESH_TOKEN_KEY);
  safeRemove(sessionStorage, ACCESS_TOKEN_KEY, "session");
  safeRemove(sessionStorage, REFRESH_TOKEN_KEY, "session");
  safeRemove(localStorage, ACCESS_TOKEN_KEY, "local");
  safeRemove(localStorage, REFRESH_TOKEN_KEY, "local");
}

export function setAdminAccessBackup(backup: AdminAccessBackup): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(backup);
  const sessionStorage = getStorage("session");
  const localStorage = getStorage("local");
  memoryStore.set(ADMIN_ACCESS_BACKUP_KEY, raw);

  const inSession = safeSet(
    sessionStorage,
    ADMIN_ACCESS_BACKUP_KEY,
    raw,
    "session",
  );
  if (inSession) {
    safeRemove(localStorage, ADMIN_ACCESS_BACKUP_KEY, "local");
    return;
  }
  safeSet(localStorage, ADMIN_ACCESS_BACKUP_KEY, raw, "local");
}

export function getAdminAccessBackup(): AdminAccessBackup | null {
  if (typeof window === "undefined") return null;
  const sessionStorage = getStorage("session");
  const localStorage = getStorage("local");

  const raw =
    safeGet(sessionStorage, ADMIN_ACCESS_BACKUP_KEY, "session") ??
    memoryStore.get(ADMIN_ACCESS_BACKUP_KEY) ??
    safeGet(localStorage, ADMIN_ACCESS_BACKUP_KEY, "local");

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AdminAccessBackup>;
    if (
      typeof parsed.adminToken === "string" &&
      typeof parsed.adminRefreshToken === "string"
    ) {
      // Keep only session scoped backup.
      memoryStore.set(ADMIN_ACCESS_BACKUP_KEY, raw);
      const inSession = safeSet(
        sessionStorage,
        ADMIN_ACCESS_BACKUP_KEY,
        raw,
        "session",
      );
      if (inSession) {
        safeRemove(localStorage, ADMIN_ACCESS_BACKUP_KEY, "local");
      }
      return {
        adminToken: parsed.adminToken,
        adminRefreshToken: parsed.adminRefreshToken,
      };
    }
  } catch {
    // noop
  }

  return null;
}

export function clearAdminAccessBackup(): void {
  if (typeof window === "undefined") return;
  const sessionStorage = getStorage("session");
  const localStorage = getStorage("local");
  memoryStore.delete(ADMIN_ACCESS_BACKUP_KEY);
  safeRemove(sessionStorage, ADMIN_ACCESS_BACKUP_KEY, "session");
  safeRemove(localStorage, ADMIN_ACCESS_BACKUP_KEY, "local");
}
