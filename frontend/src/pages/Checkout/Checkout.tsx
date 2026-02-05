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
import { Lock, Shield, Check } from "lucide-react";

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
      <div className="max-w-6xl mx-auto">
        <h1 className="checkout-page-title text-center mb-2">
          ACTIVAR ACCESO INMEDIATO
        </h1>
        <p className="checkout-page-subtitle text-center mb-8">
          Estás a un paso de desbloquear 12.5 TB de música.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-start">
          {/* Columna izquierda: Resumen de valor (desktop) / colapsado arriba (móvil) */}
          <div className="order-2 lg:order-1 rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
            <h2 className="text-slate-400 uppercase tracking-wider mb-4" style={{ fontSize: "var(--app-font-size-body)" }}>Resumen de valor</h2>
            {plan?.name && (
              <>
                <p className="text-cyan-400 font-bold text-xl md:text-2xl mb-1">
                  {plan.name}
                </p>
                <p className="text-white text-3xl md:text-4xl font-bold mb-6">
                  ${totalPrice} <span className="text-slate-400 font-normal text-lg">{plan.moneda ?? "MXN"}</span>
                </p>
                {plan.description && (
                  <p className="text-slate-400 mb-6">{plan.description}</p>
                )}
                <ul className="space-y-3 mb-6">
                  {benefits.map((label, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-300">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      </span>
                      {label}
                    </li>
                  ))}
                </ul>
                <p className="text-slate-500">
                  Duración: {plan.duration} días · Renovación automática
                </p>
              </>
            )}
            {!plan?.name && (
              <p className="text-slate-500">Cargando plan...</p>
            )}
          </div>

          {/* Columna derecha: Formulario de pago */}
          <div className="order-1 lg:order-2 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl p-6 md:p-8">
            <h2 className="text-slate-300 uppercase tracking-wider mb-2" style={{ fontSize: "var(--app-font-size-body)" }}>
              Credenciales de cuenta
            </h2>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-2">
                <span className="text-slate-500">Nombre:</span>
                <span className="text-slate-200">{currentUser?.username ?? "—"}</span>
                <span className="text-slate-500">Correo:</span>
                <span className="text-slate-200">{currentUser?.email ?? "—"}</span>
              </div>
            </div>

            {priceId && !clientSecret && !paymentAutoError ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Spinner size={4} width={0.4} color="#06b6d4" />
                <p className="mt-4 text-slate-400">
                  {plan?.id ? "Preparando pago..." : "Cargando plan..."}
                </p>
              </div>
            ) : !clientSecret ? (
              <CheckoutFormIntro plan={plan} setClientSecret={setClientSecret} />
            ) : stripeOptions ? (
              <Elements stripe={stripePromise} options={stripeOptions}>
                <CheckoutFormPayment
                  plan={plan}
                  clientSecret={clientSecret}
                  onReset={handleResetPayment}
                />
              </Elements>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Checkout;
