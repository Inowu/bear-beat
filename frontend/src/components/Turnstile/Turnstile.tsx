import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "./Turnstile.scss";

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
    size = "compact",
    invisible = false,
  },
  ref
) {
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
        language: "es",
        ...(invisible && { execution: "execute" as const }),
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
  }, [invisible]);

  useEffect(() => {
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  if (!process.env.REACT_APP_TURNSTILE_SITE_KEY) {
    return <div>Turnstile no configurado</div>;
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
