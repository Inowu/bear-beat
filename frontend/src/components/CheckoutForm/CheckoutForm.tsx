import "./CheckoutForm.scss";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import trpc from "../../api";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Spinner } from "../../components/Spinner/Spinner";
import { SuccessModal } from "../../components/Modals/SuccessModal/SuccessModal";
import { ErrorModal } from "../../components/Modals/ErrorModal/ErrorModal";
import { IPlans } from "interfaces/Plans";
import { useUserContext } from "../../contexts/UserContext";
import { useCookies } from "react-cookie";
import { trackPurchase } from "../../utils/facebookPixel";
import { trackManyChatConversion, trackManyChatPurchase, MC_EVENTS } from "../../utils/manychatPixel";
import { manychatApi } from "../../api/manychat";
import { Lock, Shield } from "lucide-react";

declare let window: any;

export function CheckoutFormIntro(props: {
  plan: IPlans;
  setClientSecret: (secret: string) => void;
}) {
  const { plan, setClientSecret } = props;
  const [loader, setLoader] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showError, setShowError] = useState(false);
  const [cookies] = useCookies(["_fbp"]);

  const handleContinuar = async () => {
    setLoader(true);
    setShowError(false);
    try {
      const result = await trpc.subscriptions.subscribeWithStripe.query({
        planId: plan.id,
        fbp: cookies._fbp,
        url: window.location.href,
      });
      if (result?.clientSecret) {
        setClientSecret(result.clientSecret);
      } else {
        setErrorMessage("No se pudo iniciar el pago. Intenta de nuevo.");
        setShowError(true);
      }
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Error al continuar al pago");
      setShowError(true);
    } finally {
      setLoader(false);
    }
  };

  return (
    <form className="checkout-form" onSubmit={(e) => e.preventDefault()}>
      <div className="button-contain">
        {loader ? (
          <Spinner size={4} width={0.4} color="#06b6d4" />
        ) : (
          <button
            type="button"
            className="checkout-cta-btn checkout-cta-btn--primary"
            onClick={handleContinuar}
            disabled={!plan?.id}
          >
            Continuar al pago
          </button>
        )}
      </div>
      <ErrorModal show={showError} onHide={() => setShowError(false)} message={errorMessage} />
    </form>
  );
}

export function CheckoutFormPayment(props: {
  plan: IPlans;
  clientSecret: string;
  onReset: () => void;
}) {
  const { plan, clientSecret, onReset } = props;
  const stripe = useStripe();
  const elements = useElements();
  const { currentUser, getPaymentMethods } = useUserContext();
  const [loader, setLoader] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const navigate = useNavigate();

  const closeSuccess = () => {
    setShowSuccess(false);
    navigate("/");
    window.location.reload();
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoader(true);
    setShowError(false);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/?payment=success`,
          payment_method_data: {
            billing_details: currentUser
              ? {
                  name: currentUser.username ?? undefined,
                  email: currentUser.email ?? undefined,
                }
              : undefined,
          },
        },
      });
      if (error) {
        setErrorMessage(error.message ?? "El pago no pudo completarse");
        setShowError(true);
        setLoader(false);
        return;
      }
      getPaymentMethods?.();
      if (currentUser) {
        const amount = Number(plan?.price) || 0;
        const currency = plan?.moneda?.toUpperCase() ?? "USD";
        trackPurchase({
          email: currentUser.email,
          phone: currentUser.phone,
          currency,
          value: amount,
        });
        trackManyChatConversion(MC_EVENTS.PAYMENT_SUCCESS);
        trackManyChatPurchase(MC_EVENTS.PAYMENT_SUCCESS, amount, currency);
        try {
          await manychatApi("SUCCESSFUL_PAYMENT");
        } catch {
          /* webhook ya lo agrega */
        }
      }
      setShowSuccess(true);
    } catch (err: any) {
      setErrorMessage(err?.message ?? "Error al procesar el pago");
      setShowError(true);
    } finally {
      setLoader(false);
    }
  };

  return (
    <form className="checkout-form checkout-form-payment" onSubmit={handleConfirm}>
      <div className="c-row payment-element-wrap">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      <div className="button-contain">
        <button type="button" className="checkout-cta-btn checkout-cta-btn--secondary" onClick={onReset}>
          Volver
        </button>
        {loader ? (
          <Spinner size={4} width={0.4} color="#06b6d4" />
        ) : (
          <button
            type="submit"
            className="checkout-cta-btn checkout-cta-btn--primary"
            disabled={!stripe || !elements}
          >
            🔥 DESBLOQUEAR MIS 500GB AHORA
          </button>
        )}
      </div>
      <div className="checkout-security-badges">
        <p className="checkout-security-badges__line">
          <Lock className="checkout-security-badges__icon" size={14} />
          Pagos encriptados con seguridad bancaria (256-bit SSL).
        </p>
        <p className="checkout-security-badges__line">
          <Shield className="checkout-security-badges__icon" size={14} />
          Garantía de satisfacción.
        </p>
      </div>
      <ErrorModal show={showError} onHide={() => setShowError(false)} message={errorMessage} />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        message="Gracias por tu pago, ya puedes empezar a descargar!"
        title="Compra Exitosa"
      />
    </form>
  );
}

export default CheckoutFormIntro;
