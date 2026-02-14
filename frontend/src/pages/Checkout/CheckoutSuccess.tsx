import { useSearchParams, Link } from "react-router-dom";
import "./Checkout.scss";
import { Check } from "src/icons";
import { useEffect, useRef } from "react";
import { trackManyChatConversion, trackManyChatPurchase, MC_EVENTS } from "../../utils/manychatPixel";
import { GROWTH_METRICS, trackGrowthMetric } from "../../utils/growthMetrics";
import { trackPurchase } from "../../utils/facebookPixel";
import { generateEventId } from "../../utils/marketingIds";
import trpc from "../../api";
import { useCookies } from "react-cookie";
import PublicTopNav from "../../components/PublicTopNav/PublicTopNav";

function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const trackedSuccessRef = useRef(false);
  const [cookies] = useCookies(["_fbp", "_fbc"]);

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

      // Analytics interno
      trackGrowthMetric(GROWTH_METRICS.PAYMENT_SUCCESS, {
        sessionId: sessionId ?? null,
        planId: typeof pending?.planId === "number" ? pending.planId : null,
        amount: value,
        value,
        currency,
        eventId,
      });
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
    <div className="checkout-main-container checkout2026">
      <PublicTopNav className="checkout2026__topnav" plansTo="/planes" />
      <main className="checkout2026__main" aria-label="Checkout">
        <div className="checkout2026__container checkout2026__center">
          <div className="checkout-card checkout-success-card">
            <div className="checkout-success-card__icon-wrap">
              <span className="checkout-summary__check checkout-success-card__icon">
                <Check className="checkout-success-card__icon-check" />
              </span>
            </div>
            <h1 className="checkout-one-state__title">Pago realizado</h1>
            <p className="checkout-summary__desc checkout-success-card__desc">
              Gracias por tu compra. Tu acceso está siendo activado.
            </p>
            <ul className="checkout-success-card__steps">
              <li>Entra al explorador y valida tu acceso.</li>
              <li>Si aún no aparece, recarga la página o cierra sesión y vuelve a iniciar.</li>
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default CheckoutSuccess;
