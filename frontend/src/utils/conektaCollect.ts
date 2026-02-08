declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Conekta?: any;
  }
}

const CONEKTA_JS_SRC = "https://cdn.conekta.io/js/latest/conekta.js";

let loadPromise: Promise<void> | null = null;

function loadScriptOnce(src: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

export async function ensureConektaCollectLoaded(): Promise<void> {
  if (typeof window === "undefined") return;

  if (!loadPromise) {
    loadPromise = loadScriptOnce(CONEKTA_JS_SRC).then(() => {
      const publicKey = process.env.REACT_APP_CONEKTA_PUBLIC_KEY;
      if (publicKey && window.Conekta?.setPublicKey) {
        try {
          window.Conekta.setPublicKey(publicKey);
        } catch {
          // No bloquear el checkout si el setPublicKey falla.
        }
      }
    });
  }

  return loadPromise;
}

export async function getConektaFingerprint(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    await ensureConektaCollectLoaded();
  } catch {
    // Ignorar errores de carga, el checkout puede seguir sin fingerprint.
  }

  const fromSdk = window.Conekta?._helpers?.getSessionId?.();
  if (typeof fromSdk === "string" && fromSdk.trim()) return fromSdk.trim();

  try {
    const fromLs = window.localStorage.getItem("_conekta_session_id");
    if (fromLs && fromLs.trim()) return fromLs.trim();
  } catch {
    // noop
  }

  return null;
}

