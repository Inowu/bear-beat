import "./Checkout.scss";
import { useUserContext } from "../../contexts/UserContext";
import { useLocation, Link } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import trpc from "../../api";
import { IPlans } from "interfaces/Plans";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { manychatApi } from "../../api/manychat";
import { Spinner } from "../../components/Spinner/Spinner";
import { Check, CreditCard, Lock, ShieldCheck } from "lucide-react";
import { ErrorModal } from "../../components/Modals/ErrorModal/ErrorModal";

function Checkout() {
  const [plan, setPlan] = useState<IPlans | null>(null);
  const location = useLocation();
  const [redirecting, setRedirecting] = useState(false);
  const [showRedirectHelp, setShowRedirectHelp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const autoFetchedRef = useRef(false);
  const searchParams = new URLSearchParams(location.search);
  const priceId = searchParams.get("priceId");
  const { currentUser } = useUserContext();

  const checkManyChat = async (p: IPlans | undefined) => {
    if (!p) return;
    trackManyChatConversion(MC_EVENTS.START_CHECKOUT);
    if (p.name?.includes("Curioso")) {
      try {
        await manychatApi("CHECKOUT_PLAN_CURIOSO");
      } catch {
        /* fallback */
      }
    } else if (p.name?.includes("Oro")) {
      try {
        await manychatApi("CHECKOUT_PLAN_ORO");
      } catch {
        /* fallback */
      }
    }
  };

  const getPlans = async (id: string | null) => {
    if (!id) return;
    const id_plan = +id;
    const body = { where: { activated: 1, id: id_plan } };
    try {
      const plans: IPlans[] = await trpc.plans.findManyPlans.query(body);
      const p = plans?.[0] ?? null;
      setPlan(p);
      if (p) checkManyChat(p);
    } catch {
      setPlan(null);
    }
  };

  useEffect(() => {
    autoFetchedRef.current = false;
    setRedirecting(false);
    setShowRedirectHelp(false);
    if (priceId) getPlans(priceId);
    else setPlan(null);
  }, [priceId]);

  const startStripeCheckout = useCallback(() => {
    if (!priceId || !plan?.id) return;

    autoFetchedRef.current = true;
    setRedirecting(true);
    setShowRedirectHelp(false);
    const origin = window.location.origin;
    const successUrl = `${origin}/comprar/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/planes`;

    trpc.subscriptions.createStripeCheckoutSession
      .mutate({
        planId: plan.id,
        successUrl,
        cancelUrl,
      })
      .then((result: { url?: string | null }) => {
        if (result?.url) {
          window.location.href = result.url;
        } else {
          setErrorMessage("No se pudo abrir la página de pago. Intenta de nuevo.");
          setShowError(true);
          setRedirecting(false);
        }
      })
      .catch((err: { message?: string }) => {
        const msg = err?.message ?? "";
        const isProcedureMissing =
          /mutation.*procedure|createStripeCheckoutSession/i.test(msg);
        setErrorMessage(
          isProcedureMissing
            ? "El pago con tarjeta no está disponible en este momento. Por favor, intenta más tarde o contacta a soporte."
            : msg || "Error al preparar el pago. Intenta de nuevo."
        );
        setShowError(true);
        setRedirecting(false);
        autoFetchedRef.current = false;
      });
  }, [priceId, plan?.id]);

  useEffect(() => {
    if (!priceId || !plan?.id || redirecting || autoFetchedRef.current) return;
    startStripeCheckout();
  }, [priceId, plan?.id, redirecting, startStripeCheckout]);

  useEffect(() => {
    if (!redirecting) return;
    const timeout = window.setTimeout(() => {
      setShowRedirectHelp(true);
    }, 6000);
    return () => window.clearTimeout(timeout);
  }, [redirecting]);

  const discount = 0;
  const totalPrice = (
    parseInt(plan?.price || "0", 10) -
    parseInt(plan?.price || "0", 10) * (discount / 100)
  ).toFixed(2);

  const benefits = [
    "Acceso FTP Ilimitado",
    "Sin Límite de Velocidad",
    "Cancela cuando quieras",
  ];

  if (!priceId) {
    return (
      <div className="checkout-main-container">
        <div className="checkout-inner">
          <header className="checkout-header">
            <h1 className="checkout-page-title">Activar acceso</h1>
            <p className="checkout-page-subtitle">
              Elige un plan en la página de planes para continuar.
            </p>
          </header>
          <Link
            to="/planes"
            className="checkout-cta-btn checkout-cta-btn--primary"
            style={{ display: "inline-block", textAlign: "center", marginTop: "1rem" }}
          >
            Ver planes
          </Link>
        </div>
      </div>
    );
  }

  // Estado único: redirigiendo a Stripe → pantalla clara, sin grid
  if (redirecting) {
    return (
      <div className="checkout-main-container checkout-main-container--redirecting">
        <div className="checkout-one-state">
          <Spinner size={5} width={0.4} color="var(--app-accent)" />
          <h2 className="checkout-one-state__title">Preparando tu pago</h2>
          <p className="checkout-one-state__text">
            Serás redirigido a la pasarela segura de Stripe en un momento…
          </p>
          {showRedirectHelp && (
            <div className="checkout-one-state__help">
              <p>Si no te redirige, vuelve a intentar desde planes.</p>
              <Link to="/planes" className="checkout-cta-btn checkout-cta-btn--ghost">
                Volver a planes
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Plan aún cargando → una sola pantalla de carga
  if (!plan) {
    return (
      <div className="checkout-main-container checkout-main-container--redirecting">
        <div className="checkout-one-state">
          <Spinner size={5} width={0.4} color="var(--app-accent)" />
          <p className="checkout-one-state__text">Cargando plan…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-main-container">
      <div className="checkout-inner">
        <header className="checkout-header">
          <h1 className="checkout-page-title">Activar acceso inmediato</h1>
          <p className="checkout-page-subtitle">
            Serás redirigido a la pasarela de pago segura de Stripe.
          </p>
          <div className="checkout-trust-strip" role="list" aria-label="Confianza de pago">
            <span role="listitem"><ShieldCheck size={16} aria-hidden /> Pago seguro</span>
            <span role="listitem"><CreditCard size={16} aria-hidden /> Stripe</span>
            <span role="listitem"><Lock size={16} aria-hidden /> Cifrado bancario</span>
          </div>
        </header>

        <div className="checkout-grid">
          <aside className="checkout-card checkout-summary">
            <h2 className="checkout-card__title">Resumen del plan</h2>
            <p className="checkout-summary__plan-name">{plan.name}</p>
            <p className="checkout-summary__price">
              ${totalPrice} <span className="checkout-summary__currency">{plan.moneda ?? "MXN"}</span>
            </p>
            {plan.description && (
              <p className="checkout-summary__desc">{plan.description}</p>
            )}
            <ul className="checkout-summary__benefits">
              {benefits.map((label, i) => (
                <li key={i}>
                  <span className="checkout-summary__check">
                    <Check className="checkout-summary__check-icon" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <p className="checkout-summary__meta">
              Duración: {plan.duration} días · Renovación automática
            </p>
          </aside>

          <section className="checkout-card checkout-payment-card">
            <h2 className="checkout-card__title">Tu cuenta</h2>
            <div className="checkout-credentials">
              <div className="checkout-credentials__row">
                <span className="checkout-credentials__label">Nombre</span>
                <span className="checkout-credentials__value">{currentUser?.username ?? "—"}</span>
              </div>
              <div className="checkout-credentials__row">
                <span className="checkout-credentials__label">Correo</span>
                <span className="checkout-credentials__value">{currentUser?.email ?? "—"}</span>
              </div>
            </div>
            <button
              type="button"
              className="checkout-cta-btn checkout-cta-btn--primary"
              onClick={startStripeCheckout}
            >
              Continuar al pago seguro
            </button>
            <p className="checkout-payment-note">Si la redirección automática falla, puedes continuar con este botón.</p>
          </section>
        </div>
      </div>

      <ErrorModal
        show={showError}
        onHide={() => setShowError(false)}
        message={errorMessage ?? ""}
        user={currentUser ?? undefined}
      />
    </div>
  );
}

export default Checkout;
