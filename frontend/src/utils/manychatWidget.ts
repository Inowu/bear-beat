const MANYCHAT_WIDGET_SRC = "https://widget.manychat.com/104901938679498.js";
const MANYCHAT_RUNTIME_SRC = "https://mccdn.me/assets/js/widget.js";
const MANYCHAT_ID = "104901938679498";
const MANYCHAT_MIN_DELAY_MS = 8000;

const SCRIPT_ATTR = "data-bb-manychat";

let manychatBootPromise: Promise<void> | null = null;

function shouldLoadManychat(pathname: string): boolean {
  const blockedPrefixes = ["/admin", "/auth", "/comprar", "/descargas", "/micuenta"];
  return !blockedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function loadScriptOnce(src: string): Promise<void> {
  const selector = `script[${SCRIPT_ATTR}='${src}']`;
  const existing = document.querySelector<HTMLScriptElement>(selector);
  if (existing) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.async = true;
    script.setAttribute(SCRIPT_ATTR, src);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function initManychatPlugin(): void {
  const messenger = (window as any)?.MessengerExtensions;
  if (!messenger?.getUserID || !messenger?.ManyChat) return;

  try {
    messenger.getUserID(
      (uids: { psid?: string }) => {
        const psid = uids?.psid;
        if (!psid) return;
        (window as any).manychatPlugin = new messenger.ManyChat(MANYCHAT_ID, MANYCHAT_ID, psid);
      },
      () => {}
    );
  } catch {
    // no-op
  }
}

export function scheduleManychatWidget(): void {
  if (typeof window === "undefined") return;
  if (!shouldLoadManychat(window.location.pathname)) return;

  const maybeWindow = window as Window & {
    __bbManychatScheduled?: boolean;
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  };

  if (maybeWindow.__bbManychatScheduled) return;
  maybeWindow.__bbManychatScheduled = true;

  const boot = async () => {
    if (!manychatBootPromise) {
      manychatBootPromise = Promise.all([
        loadScriptOnce(MANYCHAT_WIDGET_SRC),
        loadScriptOnce(MANYCHAT_RUNTIME_SRC),
      ]).then(() => undefined);
    }
    await manychatBootPromise;

    if (document.readyState === "complete") {
      initManychatPlugin();
      return;
    }
    window.addEventListener("load", initManychatPlugin, { once: true });
  };

  const scheduleBoot = () => {
    if (typeof maybeWindow.requestIdleCallback === "function") {
      maybeWindow.requestIdleCallback(() => {
        void boot();
      }, { timeout: 3000 });
      return;
    }
    void boot();
  };

  window.setTimeout(scheduleBoot, MANYCHAT_MIN_DELAY_MS);
}
