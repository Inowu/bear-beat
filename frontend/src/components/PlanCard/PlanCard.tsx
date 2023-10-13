import { PlanI } from "../../interfaces/Plans";
import "./PlanCard.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import trpc from "../../api";
import { PayPalButtons } from "@paypal/react-paypal-js";

interface PlanCardPropsI {
  plan: PlanI;
}

let order: number;

function PlanCard(props: PlanCardPropsI) {
  const { plan } = props;
  const navigate = useNavigate();

  const handleCheckout = async (planId: number) => {
    navigate(`/comprar?priceId=${planId}`);
  };

  return (
    <div className="plan-card-main-card">
      <div className="c-row">
        <h2>{plan.title}</h2>
      </div>
      <div className="c-row">
        <h3>{plan.price}</h3>
      </div>
      <div className="c-row">
        <p>{plan.description}</p>
      </div>
      <div className="c-row">
        <p>Duración (En días): {plan.duration}</p>
      </div>
      <div className="c-row">
        <p>Acceso a la carpeta</p>
      </div>
      {plan.included.map((ad) => {
        return (
          <div className="c-row" key={ad}>
            <p>
              <FontAwesomeIcon icon={faCheck} /> {ad}
            </p>
          </div>
        );
      })}
      <div className="c-row">
        <p>Contenido en gigas disponibles: {plan.space}</p>
      </div>
      <PayPalButtons
        onClick={async (data, actions) => {
          // Revisar si el usuario tiene una suscripcion activa
          const me = await trpc.auth.me.query();

          if (me.hasActiveSubscription) return actions.reject();

          const existingOrder = await trpc.orders.ownOrders.query({
            where: {
              AND: [
                {
                  status: 0,
                },
                {
                  payment_method: "Paypal",
                },
              ],
            },
          });

          if (existingOrder.length > 0) {
            return actions.reject();
          }

          actions.resolve();
        }}
        onApprove={async (data, actions) => {
          console.log("On approve: ", data, actions);

          try {
            const sub = await trpc.subscriptions.subscribeWithPaypal.mutate({
              planId: 14,
              subscriptionId: data.subscriptionID!,
            });

            console.log(sub);
          } catch (e: any) {
            console.log(e.message);
          }
        }}
        createSubscription={async (data, actions) => {
          console.log("create subscription: ", data, actions);

          try {
            const sub = await trpc.subscriptions.subscribeWithPaypal.mutate({
              planId: 14,
              subscriptionId: "",
            });

            console.log(sub);
          } catch (e: any) {
            console.log(e.message);
          }

          try {
            const sub = await actions.subscription.create({
              plan_id: "P-92327832UX314920EMR7ULSQ",
            });
            console.log(sub);

            // const result = await trpc.orders.createPaypalOrder.mutate({
            //   planId: 14,
            //   subscriptionId: sub,
            // });
            //
            // console.log(result);
            //
            // order = result.id;

            return sub;
          } catch (e: any) {
            console.log(e?.message);
          }

          return "";
        }}
      />
      <button
        onClick={async () => {
          try {
            // const res = await trpc.ftp.download.query({
            //   path: "test.mp3",
            // });

            const res = await fetch("http://localhost:5000/download").then(
              (r) => r.json(),
            );
            console.log(res);
          } catch (e) {
            console.log(e);
          }
        }}
      >
        COMPRAR CON TARJETA
      </button>
      <button
        onClick={async () => {
          try {
            const res =
              await trpc.subscriptions.subscribeWithCashConekta.mutate({
                planId: 14,
                paymentMethod: "cash" as const,
              });
            console.log(res);
          } catch (e: any) {
            console.log(e);
          }
        }}
      >
        COMPRAR CON PAYPAL
      </button>
    </div>
  );
}

export default PlanCard;
