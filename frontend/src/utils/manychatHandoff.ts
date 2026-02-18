import { apiBaseUrl } from "./runtimeConfig";
import { loadManyChatOnce, waitForManyChatPixelReady } from "./manychatLoader";

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

    // Remove `mc_t` ASAP (only we need it). For `mcp_token`, we intentionally keep it around
    // briefly so ManyChat's widget/pixel can read it, then strip it in `initManyChatHandoff()`
    // before initializing other trackers (Meta pixel, Hotjar, etc).
    url.searchParams.delete("mc_t");
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

export function initManyChatHandoff(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  // Capture (and strip) synchronously.
  const token = captureManyChatHandoffFromUrl() ?? getManyChatHandoffToken();
  const url = new URL(window.location.href);
  const hasMcpToken = Boolean((url.searchParams.get("mcp_token") ?? "").trim());

  // Resolve in the background (best-effort).
  if (token) {
    const existing = getStoredManyChatHandoffPayload();
    if (!(existing?.token === token && existing?.data?.ok)) {
      window.setTimeout(() => {
        void resolveManyChatHandoffToken(token);
      }, 0);
    }
  }

  // If `mcp_token` exists, keep it in the URL until ManyChat's widget/pixel becomes ready (or a timeout),
  // then strip it to prevent leaking it to other trackers.
  if (!hasMcpToken) return Promise.resolve();

  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const maxWaitMs = isMobile ? 6500 : 3000;
  const pollEveryMs = 120;

  // Dynamic-load ManyChat scripts when mcp_token exists so attribution is not lost.
  // Any loading failure is tolerated: we still strip the token after timeout.
  void loadManyChatOnce().catch(() => {
    // noop
  });

  const stripMcpToken = (): void => {
    try {
      const nextUrl = new URL(window.location.href);
      const current = (nextUrl.searchParams.get("mcp_token") ?? "").trim();
      if (!current) return;
      nextUrl.searchParams.delete("mcp_token");
      const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      window.history.replaceState(null, "", next);
    } catch {
      // noop
    }
  };

  return waitForManyChatPixelReady({
    maxWaitMs,
    pollEveryMs,
  }).then(() => {
    stripMcpToken();
  });
}
