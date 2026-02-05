import "./Checkout.scss";
import { useUserContext } from "../../contexts/UserContext";
import { useLocation, Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import trpc from "../../api";
import { IPlans } from "interfaces/Plans";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { manychatApi } from "../../api/manychat";
import { Spinner } from "../../components/Spinner/Spinner";
import { Check } from "lucide-react";
import { ErrorModal } from "../../components/Modals/ErrorModal/ErrorModal";

function Checkout() {
  const [plan, setPlan] = useState<IPlans | null>(null);
  const location = useLocation();
  const [redirecting, setRedirecting] = useState(false);
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
    if (priceId) getPlans(priceId);
    else setPlan(null);
  }, [priceId]);

  useEffect(() => {
    if (!priceId || !plan?.id || redirecting || autoFetchedRef.current) return;
    autoFetchedRef.current = true;
    setRedirecting(true);
    const origin = window.location.origin;
    const successUrl = `${origin}/comprar/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/planes`;

    trpc.subscriptions.createStripeCheckoutSession
      .mutate({
        planId: plan.id,
        successUrl,
        cancelUrl,
      })
      .then((result) => {
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
  }, [priceId, plan?.id, redirecting]);

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
