// Lightweight bridge so MainLayout can record SPA navigations without importing
// the full Hotjar/Contentsquare integration (which can inject 3rd-party scripts).

type HotjarStateChangeFn = (path: string) => void;

declare global {
  interface Window {
    __bbHotjarStateChange?: HotjarStateChangeFn;
    __bbHotjarLastPath?: string;
  }
}

export function queueHotjarStateChange(path: string): void {
  if (typeof window === "undefined") return;
  const normalized = `${path ?? ""}`;
  window.__bbHotjarLastPath = normalized;

  const fn = window.__bbHotjarStateChange;
  if (typeof fn !== "function") return;
  try {
    fn(normalized);
  } catch {
    // noop
  }
}

export function bindHotjarStateChange(fn: HotjarStateChangeFn): void {
  if (typeof window === "undefined") return;
  window.__bbHotjarStateChange = fn;

  const last = window.__bbHotjarLastPath;
  if (!last) return;
  try {
    fn(last);
  } catch {
    // noop
  }
}

