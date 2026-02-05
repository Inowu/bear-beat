import { Elements } from "@stripe/react-stripe-js";
import { CheckoutFormIntro, CheckoutFormPayment } from "../../components/CheckoutForm/CheckoutForm";
import "./Checkout.scss";
import { loadStripe } from "@stripe/stripe-js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useUserContext } from "../../contexts/UserContext";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import trpc from "../../api";
import { IPlans } from "interfaces/Plans";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { manychatApi } from "../../api/manychat";

const stripeKey =
  process.env.REACT_APP_ENVIRONMENT === "development"
    ? (process.env.REACT_APP_STRIPE_TEST_KEY as string)
    : (process.env.REACT_APP_STRIPE_KEY as string);

const stripePromise = loadStripe(stripeKey);

function Checkout() {
  const [plan, setPlan] = useState({} as IPlans);
  const location = useLocation();
  const [discount, setDiscount] = useState<number>(0);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
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

  return (
    <div className="checkout-main-container">
      <div className="checkout-card">
        <div className="payment-container">
          <h2>Billing information</h2>
          <div className="order-info-container">
            <div className="c-row">
              <b>Name: </b>
              <p>{currentUser?.username}</p>
            </div>
            <div className="c-row">
              <b>E-mail</b>
              <p>{currentUser?.email}</p>
            </div>
          </div>
          {!clientSecret ? (
            <CheckoutFormIntro
              plan={plan}
              discount={discount}
              setDiscount={setDiscount}
              setClientSecret={setClientSecret}
            />
          ) : (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "stripe",
                  variables: {
                    colorPrimary: "#06b6d4",
                    borderRadius: "8px",
                  },
                },
              }}
            >
              <CheckoutFormPayment
                plan={plan}
                clientSecret={clientSecret}
                onReset={() => setClientSecret(null)}
              />
            </Elements>
          )}
        </div>
        <div className="information-container">
          <h2>Order</h2>
          <div className="item-information-container">
            <hr />
            <b>
              {plan.name} - Duración {plan.duration} días
            </b>
            <b>{plan.description}</b>
            <b>Contenido en gigas disponible: {plan.duration}</b>
            <b>
              <FontAwesomeIcon icon={faCheck} /> RENOVACIÓN CADA 30 DÍAS
            </b>
            <div className="total">
              <b>Total de la orden</b>
              <b>
                $
                {(
                  parseInt(plan.price || "0") -
                  parseInt(plan.price || "0") * (discount / 100)
                ).toFixed(2)}{" "}
                {plan.moneda}
              </b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Checkout;
