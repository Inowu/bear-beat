import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "./Turnstile.scss";
import {
  shouldBypassTurnstile,
  TURNSTILE_BYPASS_TOKEN,
} from "../../utils/turnstile";

const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_SCRIPT_ATTR = "data-bb-turnstile";
let turnstileScriptPromise: Promise<void> | null = null;

function ensureTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[${TURNSTILE_SCRIPT_ATTR}='1']`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile script failed to load")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.setAttribute(TURNSTILE_SCRIPT_ATTR, "1");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed to load"));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  /** 'execute' = no corre hasta llamar a execute(); así el widget puede ir oculto y ejecutarse al enviar el form */
  execution?: "render" | "execute";
  /** Idioma del widget (ej. 'es') */
  language?: string;
};

export type TurnstileRef = {
  execute: () => void;
};

type TurnstileProps = {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  resetSignal?: number;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  /**
   * true = widget invisible: no ocupa espacio ni se muestra.
   * La verificación se dispara al llamar ref.execute() (típicamente al enviar el formulario).
   * Ideal para que no se vea el cuadro de Cloudflare y se adapte al diseño.
   */
  invisible?: boolean;
};

const TURNSTILE_VERIFY_INTERVAL_MS = 50;

const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(function Turnstile(
  {
    onVerify,
    onExpire,
    onError,
    resetSignal = 0,
    theme = "dark",
    size = "flexible",
    invisible = false,
  },
  ref
) {
  const isBypassed = shouldBypassTurnstile();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onVerifyRef.current = onVerify;
  }, [onVerify]);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useImperativeHandle(
    ref,
    () => ({
      execute() {
        if (window.turnstile && containerRef.current) {
          window.turnstile.execute(containerRef.current);
        }
      },
    }),
    []
  );

  useEffect(() => {
    if (!isBypassed) return;
    onVerifyRef.current(TURNSTILE_BYPASS_TOKEN);
  }, [isBypassed]);

  useEffect(() => {
    if (isBypassed) return;

    const siteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;
    if (!siteKey || !containerRef.current) {
      return;
    }

    let cancelled = false;
    let intervalId: number | undefined;

    const renderWidget = () => {
      if (cancelled || !window.turnstile || !containerRef.current || widgetIdRef.current) {
        return;
      }

      const options: TurnstileOptions = {
        sitekey: siteKey,
        callback: (token: string) => onVerifyRef.current(token),
        "expired-callback": () => onExpireRef.current?.(),
        "error-callback": () => onErrorRef.current?.(),
        theme,
        size,
        language: "es",
        ...(invisible && { execution: "execute" as const }),
      };

      widgetIdRef.current = window.turnstile.render(containerRef.current, options);
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    void ensureTurnstileScript()
      .then(() => {
        if (cancelled) return;
        if (window.turnstile) {
          renderWidget();
        } else {
          intervalId = window.setInterval(renderWidget, TURNSTILE_VERIFY_INTERVAL_MS);
        }
      })
      .catch(() => onErrorRef.current?.());

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [invisible, isBypassed, size, theme]);

  useEffect(() => {
    if (isBypassed) return;
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal, isBypassed]);

  if (isBypassed || !process.env.REACT_APP_TURNSTILE_SITE_KEY) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={invisible ? "turnstile-widget-wrap turnstile-invisible" : "turnstile-widget-wrap"}
      aria-hidden={invisible ? true : undefined}
    />
  );
});

export default Turnstile;
