const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const ADMIN_ACCESS_BACKUP_KEY = "isAdminAccess";

export interface AdminAccessBackup {
  adminToken: string;
  adminRefreshToken: string;
}

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // noop
  }
}

function safeRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // noop
  }
}

function readTokenWithMigration(key: string): string | null {
  if (typeof window === "undefined") return null;

  const fromSession = safeGet(window.sessionStorage, key);
  if (fromSession) return fromSession;

  // Backward compatibility: migrate token from localStorage to sessionStorage once.
  const fromLocal = safeGet(window.localStorage, key);
  if (fromLocal) {
    safeSet(window.sessionStorage, key, fromLocal);
    safeRemove(window.localStorage, key);
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
  safeSet(window.sessionStorage, ACCESS_TOKEN_KEY, token);
  safeSet(window.sessionStorage, REFRESH_TOKEN_KEY, refreshToken);
  safeRemove(window.localStorage, ACCESS_TOKEN_KEY);
  safeRemove(window.localStorage, REFRESH_TOKEN_KEY);
}

export function clearAuthTokens(): void {
  if (typeof window === "undefined") return;
  safeRemove(window.sessionStorage, ACCESS_TOKEN_KEY);
  safeRemove(window.sessionStorage, REFRESH_TOKEN_KEY);
  safeRemove(window.localStorage, ACCESS_TOKEN_KEY);
  safeRemove(window.localStorage, REFRESH_TOKEN_KEY);
}

export function setAdminAccessBackup(backup: AdminAccessBackup): void {
  if (typeof window === "undefined") return;
  safeSet(window.sessionStorage, ADMIN_ACCESS_BACKUP_KEY, JSON.stringify(backup));
  safeRemove(window.localStorage, ADMIN_ACCESS_BACKUP_KEY);
}

export function getAdminAccessBackup(): AdminAccessBackup | null {
  if (typeof window === "undefined") return null;

  const raw =
    safeGet(window.sessionStorage, ADMIN_ACCESS_BACKUP_KEY) ??
    safeGet(window.localStorage, ADMIN_ACCESS_BACKUP_KEY);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AdminAccessBackup>;
    if (
      typeof parsed.adminToken === "string" &&
      typeof parsed.adminRefreshToken === "string"
    ) {
      // Keep only session scoped backup.
      safeSet(window.sessionStorage, ADMIN_ACCESS_BACKUP_KEY, raw);
      safeRemove(window.localStorage, ADMIN_ACCESS_BACKUP_KEY);
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
  safeRemove(window.sessionStorage, ADMIN_ACCESS_BACKUP_KEY);
  safeRemove(window.localStorage, ADMIN_ACCESS_BACKUP_KEY);
}
