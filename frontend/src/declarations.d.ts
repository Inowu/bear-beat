declare module "*.mp4" {
  const src: string;
  export default src;
}

type TurnstileRenderOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};

interface Turnstile {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
  /** Ejecuta el reto (cuando el widget usa execution: 'execute'). Acepta selector o elemento. */
  execute: (containerOrId: string | HTMLElement) => void;
}

interface Window {
  turnstile?: Turnstile;
}
