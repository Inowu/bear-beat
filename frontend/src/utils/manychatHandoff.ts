import { apiBaseUrl } from "./runtimeConfig";

export type ManyChatHandoffSnapshot = {
  contactId: string | null;
  channel: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  ref: string | null;
};

type ResolveOk = {
  ok: true;
  contactId: string | null;
  channel: string | null;
  snapshot: ManyChatHandoffSnapshot | null;
  createdAt: string;
  expiresAt: string;
  claimedUserId: number | null;
};

type ResolveErr = {
  ok: false;
  reason?: string;
  message?: string;
};

type ResolveResponse = ResolveOk | ResolveErr;

type StoredPayload = {
  token: string;
  resolvedAt: string;
  data: ResolveOk;
};

const STORAGE_TOKEN = "bb_mc_handoff_token";
const STORAGE_PAYLOAD = "bb_mc_handoff_payload_v1";

function safeReadLocalStorage(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteLocalStorage(key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // noop
  }
}

function safeRemoveLocalStorage(key: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch {
    // noop
  }
}

export function getManyChatHandoffToken(): string | null {
  const raw = safeReadLocalStorage(STORAGE_TOKEN);
  const token = (raw ?? "").trim();
  return token ? token : null;
}

export function setManyChatHandoffToken(token: string): void {
  const t = `${token ?? ""}`.trim();
  if (!t) return;
  safeWriteLocalStorage(STORAGE_TOKEN, t);
}

export function clearManyChatHandoff(): void {
  safeRemoveLocalStorage(STORAGE_TOKEN);
  safeRemoveLocalStorage(STORAGE_PAYLOAD);
}

export function captureManyChatHandoffFromUrl(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const url = new URL(window.location.href);
    const token = (url.searchParams.get("mc_t") ?? "").trim();
    const mcpToken = (url.searchParams.get("mcp_token") ?? "").trim();
    if (!token && !mcpToken) return null;

    if (token) {
      setManyChatHandoffToken(token);
    }

    // Remove tokens from the URL ASAP to avoid leaking them to third-party trackers.
    // Note: ManyChat's widget/pixel reads `mcp_token` on load; we include the ManyChat scripts
    // before our app bundle so it can capture it first.
    url.searchParams.delete("mc_t");
    url.searchParams.delete("mcp_token");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, "", next);

    // Notify listeners (useful when the user is already logged in and opens a new handoff link).
    if (token) {
      try {
        window.dispatchEvent(new CustomEvent("bb:manychat-handoff", { detail: { token } }));
      } catch {
        // noop
      }
    }

    return token || null;
  } catch {
    return null;
  }
}

export function getStoredManyChatHandoffPayload(): StoredPayload | null {
  const raw = safeReadLocalStorage(STORAGE_PAYLOAD);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPayload;
  } catch {
    return null;
  }
}

export async function resolveManyChatHandoffToken(token: string): Promise<ResolveResponse> {
  const t = `${token ?? ""}`.trim();
  if (!t) return { ok: false, reason: "invalid" };

  try {
    const res = await fetch(`${apiBaseUrl}/api/manychat/handoff/resolve?token=${encodeURIComponent(t)}`);
    const json = (await res.json()) as ResolveResponse;

    if (json && (json as any).ok === true) {
      const stored: StoredPayload = {
        token: t,
        resolvedAt: new Date().toISOString(),
        data: json as ResolveOk,
      };
      safeWriteLocalStorage(STORAGE_PAYLOAD, JSON.stringify(stored));
    }

    return json;
  } catch (error: any) {
    return { ok: false, message: error?.message ?? "Failed to resolve" };
  }
}

export function initManyChatHandoff(): void {
  if (typeof window === "undefined") return;
  // Capture (and strip) synchronously.
  const token = captureManyChatHandoffFromUrl() ?? getManyChatHandoffToken();
  if (!token) return;

  // Resolve in the background (best-effort).
  const existing = getStoredManyChatHandoffPayload();
  if (existing?.token === token && existing?.data?.ok) return;

  window.setTimeout(() => {
    void resolveManyChatHandoffToken(token);
  }, 0);
}
