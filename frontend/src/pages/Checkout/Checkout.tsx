import { Elements } from "@stripe/react-stripe-js";
import { CheckoutFormIntro, CheckoutFormPayment } from "../../components/CheckoutForm/CheckoutForm";
import "./Checkout.scss";
import { loadStripe } from "@stripe/stripe-js";
import { useUserContext } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCookies } from "react-cookie";
import trpc from "../../api";
import { IPlans } from "interfaces/Plans";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { manychatApi } from "../../api/manychat";
import { Spinner } from "../../components/Spinner/Spinner";
import { getStripeAppearance } from "../../utils/stripeAppearance";
import { Lock, Check } from "lucide-react";

const stripeKey =
  process.env.REACT_APP_ENVIRONMENT === "development"
    ? (process.env.REACT_APP_STRIPE_TEST_KEY as string)
    : (process.env.REACT_APP_STRIPE_KEY as string);

const stripePromise = loadStripe(stripeKey);

function Checkout() {
  const { theme } = useTheme();
  const [plan, setPlan] = useState({} as IPlans);
  const location = useLocation();
  const [discount] = useState<number>(0);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [paymentAutoError, setPaymentAutoError] = useState(false);
  const autoFetchedRef = useRef(false);
  const searchParams = new URLSearchParams(location.search);
  const priceId = searchParams.get("priceId");
  const { currentUser } = useUserContext();
  const [cookies] = useCookies(["_fbp"]);

  const stripeOptions = useMemo(
    () =>
      clientSecret
        ? { clientSecret, appearance: getStripeAppearance(theme) }
        : undefined,
    [clientSecret, theme]
  );

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
      const p = plans?.[0];
      setPlan(p ?? ({} as IPlans));
      checkManyChat(p);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (priceId) getPlans(priceId);
  }, [priceId]);

  useEffect(() => {
    if (!priceId || !plan?.id || clientSecret || autoFetchedRef.current) return;
    autoFetchedRef.current = true;
    setLoadingPayment(true);
    trpc.subscriptions.subscribeWithStripe
      .query({
        planId: plan.id,
        fbp: cookies._fbp,
        url: window.location.href,
      })
      .then((r) => {
        if (r?.clientSecret) setClientSecret(r.clientSecret);
        else setPaymentAutoError(true);
      })
      .catch(() => setPaymentAutoError(true))
      .finally(() => setLoadingPayment(false));
  }, [priceId, plan?.id, clientSecret, cookies._fbp]);

  const handleResetPayment = () => {
    setClientSecret(null);
  };

  const totalPrice = (
    parseInt(plan.price || "0", 10) -
    parseInt(plan.price || "0", 10) * (discount / 100)
  ).toFixed(2);

  const benefits = [
    "Acceso FTP Ilimitado",
    "Sin Límite de Velocidad",
    "Cancela cuando quieras",
  ];

  return (
    <div className="checkout-main-container">
      <div className="checkout-inner">
        <header className="checkout-header">
          <h1 className="checkout-page-title">
            Activar acceso inmediato
          </h1>
          <p className="checkout-page-subtitle">
            Estás a un paso de desbloquear 12.5 TB de música.
          </p>
        </header>

        <div className="checkout-grid">
          {/* Resumen del plan */}
          <aside className="checkout-card checkout-summary">
            <h2 className="checkout-card__title">Resumen del plan</h2>
            {plan?.name ? (
              <>
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
              </>
            ) : (
              <p className="checkout-summary__loading">Cargando plan...</p>
            )}
          </aside>

          {/* Formulario de pago */}
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

            {priceId && !clientSecret && !paymentAutoError ? (
              <div className="checkout-loading">
                <Spinner size={4} width={0.4} color="var(--app-accent)" />
                <p className="checkout-loading__text">
                  {plan?.id ? "Preparando formulario de pago..." : "Cargando plan..."}
                </p>
              </div>
            ) : !clientSecret ? (
              <CheckoutFormIntro plan={plan} setClientSecret={setClientSecret} />
            ) : stripeOptions ? (
              <>
                <h3 className="checkout-payment-title">
                  <Lock size={18} />
                  Datos de pago
                </h3>
                <Elements stripe={stripePromise} options={stripeOptions}>
                  <CheckoutFormPayment
                    plan={plan}
                    clientSecret={clientSecret}
                    onReset={handleResetPayment}
                  />
                </Elements>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

export default Checkout;
