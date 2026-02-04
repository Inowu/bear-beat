import { useEffect, useRef } from "react";

type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
};

type TurnstileProps = {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  resetSignal?: number;
  /** "dark" para fondos oscuros (registro/login dark); evita el widget blanco */
  theme?: "light" | "dark" | "auto";
  /** "compact" = 150×140px, menos espacio visual; "normal" = 300×65px; "flexible" = 100% ancho */
  size?: "normal" | "compact" | "flexible";
};

const TURNSTILE_VERIFY_INTERVAL_MS = 50;

function Turnstile({ onVerify, onExpire, onError, resetSignal = 0, theme = "dark", size = "compact" }: TurnstileProps) {
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

  useEffect(() => {
    const siteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;
    if (!siteKey || !containerRef.current) {
      return;
    }

    let intervalId: number | undefined;

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current) {
        return;
      }

      const options: TurnstileOptions = {
        sitekey: siteKey,
        callback: (token: string) => onVerifyRef.current(token),
        "expired-callback": () => onExpireRef.current?.(),
        "error-callback": () => onErrorRef.current?.(),
        theme,
        size,
      };

      widgetIdRef.current = window.turnstile.render(containerRef.current, options);
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      intervalId = window.setInterval(renderWidget, TURNSTILE_VERIFY_INTERVAL_MS);
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  if (!process.env.REACT_APP_TURNSTILE_SITE_KEY) {
    return <div>Turnstile no configurado</div>;
  }

  return <div ref={containerRef} className="turnstile-widget-wrap" />;
}

export default Turnstile;
