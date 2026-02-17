import { useSearchParams, Link } from "react-router-dom";
import "./Checkout.scss";
import { Check } from "src/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackManyChatConversion, trackManyChatPurchase, MC_EVENTS } from "../../utils/manychatPixel";
import { GROWTH_METRICS, trackGrowthMetric } from "../../utils/growthMetrics";
import { trackPurchase } from "../../utils/facebookPixel";
import { generateEventId } from "../../utils/marketingIds";
import trpc from "../../api";
import { useCookies } from "react-cookie";
import PublicTopNav from "../../components/PublicTopNav/PublicTopNav";
import { Spinner } from "../../components/Spinner/Spinner";
import { useUserContext } from "../../contexts/UserContext";

type ActivationState = "checking" | "active" | "timeout";

const ACTIVATION_MAX_WAIT_MS = 90_000;
const ACTIVATION_DELAYS_MS = [800, 1200, 1600, 2500, 3500, 5000, 8000, 8000, 8000] as const;

function isLikelyNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|network|timeout|timed out|load resource|err_/i.test(message);
}

function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const trackedSuccessRef = useRef(false);
  const [cookies] = useCookies(["_fbp", "_fbc"]);
  const { currentUser, startUser } = useUserContext();

  const [activationRunKey, setActivationRunKey] = useState(0);
  const [activationState, setActivationState] = useState<ActivationState>("checking");
  const [activationError, setActivationError] = useState<string | null>(null);

  const retryActivation = useCallback(() => {
    setActivationRunKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (currentUser?.hasActiveSubscription) {
      setActivationState("active");
      setActivationError(null);
    }
  }, [currentUser?.hasActiveSubscription]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const startedAt = Date.now();
    let attempt = 0;

    if (currentUser?.hasActiveSubscription) {
      setActivationState("active");
      setActivationError(null);
      return;
    }

    setActivationState("checking");
    setActivationError(null);

    const scheduleNext = () => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= ACTIVATION_MAX_WAIT_MS) {
        setActivationState("timeout");
        return;
      }
      const delay = ACTIVATION_DELAYS_MS[Math.min(attempt, ACTIVATION_DELAYS_MS.length - 1)] ?? 8000;
      timer = window.setTimeout(() => {
        void check();
      }, delay);
    };

    const check = async () => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= ACTIVATION_MAX_WAIT_MS) {
        setActivationState("timeout");
        return;
      }
      attempt += 1;

      try {
        const me = await trpc.auth.me.query();
        if (cancelled) return;

        if (me?.hasActiveSubscription) {
          setActivationState("active");
          setActivationError(null);
          startUser();
          return;
        }

        setActivationState("checking");
      } catch (error: unknown) {
        if (cancelled) return;
        setActivationError(
          isLikelyNetworkError(error)
            ? "No pudimos conectar para verificar tu activación. Reintentando…"
            : "No pudimos verificar tu activación. Reintentando…",
        );
        setActivationState("checking");
      }

      scheduleNext();
    };

    void check();

    return () => {
      cancelled = true;
      if (timer != null) {
        window.clearTimeout(timer);
      }
    };
  }, [activationRunKey, currentUser?.hasActiveSubscription, startUser]);

  const activationCopy = useMemo(() => {
    if (activationState === "active") {
      return {
        title: "Acceso activado",
        description: "Listo. Tu acceso ya está activo.",
        steps: ["Entra al explorador y empieza a descargar.", "Administra tu membresía desde Mi cuenta."],
      };
    }
    if (activationState === "timeout") {
      return {
        title: "Activación en proceso",
        description: "Tu pago se registró. La activación puede tardar unos minutos.",
        steps: [
          "Ve a Mi cuenta para verificar tu membresía.",
          "Si aún no aparece, espera un momento y vuelve a intentar desde aquí.",
        ],
      };
    }
    return {
      title: "Activando tu acceso",
      description: "Gracias por tu compra. Estamos activando tu acceso (puede tardar hasta 2 minutos).",
      steps: ["Te avisamos en cuanto esté listo.", "Si tarda, puedes revisar el estado desde Mi cuenta."],
    };
  }, [activationState]);

  useEffect(() => {
    if (trackedSuccessRef.current) return;
    trackedSuccessRef.current = true;

    const pendingPurchaseStorageKey = "bb.checkout.pendingPurchase";
    const purchaseDedupeKey = "bb.checkout.purchaseTracked";

    const run = async () => {
      let pending: any = null;
      try {
        const raw = window.sessionStorage.getItem(pendingPurchaseStorageKey);
        pending = raw ? JSON.parse(raw) : null;
      } catch {
        pending = null;
      }

      const dedupeToken =
        (typeof pending?.at === "string" && pending.at) ||
        (typeof sessionId === "string" && sessionId) ||
        "";

      try {
        const already = window.sessionStorage.getItem(purchaseDedupeKey);
        if (already && dedupeToken && already === dedupeToken) {
          return;
        }
      } catch {
        // noop
      }

      const value =
        typeof pending?.value === "number" && Number.isFinite(pending.value)
          ? pending.value
          : 0;
      const currency =
        typeof pending?.currency === "string" && pending.currency.trim()
          ? pending.currency.trim().toUpperCase()
          : "USD";

      const eventId =
        typeof pending?.purchaseEventId === "string" && pending.purchaseEventId.trim()
          ? pending.purchaseEventId.trim()
          : generateEventId("purchase");

      // Meta Pixel (browser) + ManyChat Pixel
      trackPurchase({ value, currency, eventId });
      trackManyChatConversion(MC_EVENTS.PAYMENT_SUCCESS);
      if (value > 0) trackManyChatPurchase(MC_EVENTS.PAYMENT_SUCCESS, value, currency);

      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_SUCCESS, {
        sessionId: sessionId ?? null,
        planId: typeof pending?.planId === "number" ? pending.planId : null,
        amount: value,
        currency,
        eventId,
      });

      const method = typeof pending?.method === "string" ? pending.method : "";
      const serverSidePurchaseTracking = pending?.serverSidePurchaseTracking === true;

      // Meta CAPI fallback (server) only when server-side purchase tracking is not enabled yet.
      // For PayPal, the backend already sends Purchase on subscription creation.
      if (!serverSidePurchaseTracking && method === "card") {
        try {
          await trpc.users.sendFacebookEvent.mutate({
            event: "Purchase",
            url: window.location.href,
            fbp: cookies._fbp,
            fbc: cookies._fbc,
            eventId,
            value,
            currency,
          });
        } catch {
          // No bloquear UX por tracking
        }
      }

      try {
        window.sessionStorage.setItem(purchaseDedupeKey, dedupeToken || eventId);
        window.sessionStorage.removeItem(pendingPurchaseStorageKey);
      } catch {
        // noop
      }
    };

    void run();
  }, [sessionId, cookies._fbp, cookies._fbc]);

  return (
    <div className="checkout-main-container checkout2026 bb-marketing-page bb-marketing-page--checkout bb-marketing-page--flat-cards">
      <PublicTopNav className="checkout2026__topnav" plansTo="/planes" />
      <section className="checkout2026__main" aria-label="Checkout">
        <div className="checkout2026__container checkout2026__center">
          <div className="checkout-card bb-hero-card checkout-success-card">
            <div className="checkout-success-card__icon-wrap">
              <span className="checkout-summary__check checkout-success-card__icon">
                {activationState === "active" ? (
                  <Check className="checkout-success-card__icon-check" />
                ) : (
                  <span aria-hidden style={{ width: 44, height: 44 }}>
                    <Spinner size={2.15} width={0.22} color="var(--app-accent)" label="" />
                  </span>
                )}
              </span>
            </div>
            <h1 className="checkout-one-state__title">Pago realizado</h1>
            <p className="checkout-summary__desc checkout-success-card__desc">{activationCopy.description}</p>
            <p className="checkout-summary__meta">
              <strong style={{ color: "var(--app-text-heading)" }}>{activationCopy.title}</strong>
              {activationState === "checking" ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: 10 }}>
                  <span aria-hidden style={{ width: 18, height: 18 }}>
                    <Spinner size={0.9} width={0.18} color="var(--app-accent)" label="" />
                  </span>
                  Verificando…
                </span>
              ) : null}
            </p>
            {activationError ? (
              <p className="checkout-summary__meta" role="status" aria-live="polite">
                {activationError}
              </p>
            ) : null}
            <ul className="checkout-success-card__steps">
              {activationCopy.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            {sessionId && (
              <p className="checkout-summary__meta checkout-success-card__meta">
                Referencia: {sessionId.slice(0, 20)}…
              </p>
            )}
            <div className="checkout-success-card__actions">
              <Link to="/" className="checkout-cta-btn checkout-cta-btn--primary">
                Ir al explorador
              </Link>
              <Link to="/micuenta" className="checkout-cta-btn checkout-cta-btn--ghost">
                Ir a mi cuenta
              </Link>
              {activationState === "timeout" ? (
                <button type="button" className="checkout-cta-btn checkout-cta-btn--ghost" onClick={retryActivation}>
                  Reintentar verificación
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default CheckoutSuccess;
