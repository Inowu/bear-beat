import "./CheckoutForm.scss";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import trpc from "../../api";
import { visitFunctionBody } from "typescript";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Spinner } from "../../components/Spinner/Spinner";
import { SuccessModal } from "../../components/Modals/SuccessModal/SuccessModal";
import { ErrorModal } from "../../components/Modals/ErrorModal/ErrorModal";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { IPlans } from "interfaces/Plans";
import { returnPricePaypal } from "../../functions/Methods";
declare let window: any;

interface ICheckout {
  plan: IPlans;
}

function CheckoutForm(props: ICheckout) {
  const [loader, setLoader] = useState<boolean>(false);
  const [coupon, setCoupon] = useState<string>("");
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const [initialValues, setInitialValues] = useState<any>(null);
  const [cardInfo, setCardInfo] = useState({
    card: "",
    month: "",
    year: "",
    cvv: "",
    name: "",
  });
  const { plan } = props;
  const stripe: any = useStripe();
  const elements = useElements();
  const random_number: number = Math.random();
  const [order, setOrder] = useState(0);
  const navigate = useNavigate();
  const closeError = () => {
    setShow(false);
  };
  const closeSuccess = () => {
    setShowSuccess(false);
    navigate("/");
    window.location.reload();
  };
  const conectaSuscribe = async () => {
    let tempCard = {
      card: {
        number: cardInfo.card.replaceAll(" ", ""),
        name: cardInfo.name,
        exp_month: cardInfo.month,
        exp_year: cardInfo.year,
        cvc: cardInfo.cvv,
      }
    }
    window.Conekta.token.create(
      tempCard,
      conektaSuccessResponseHandler,
      conektaErrorResponseHandler, 'web'
    );
  };
  const conektaSuccessResponseHandler = async (token: any) => {
    let tokenId = token.id
    let body_conekta = {
      cardToken: tokenId,
      planId: plan.id,
      makeDefault: "true",
    };
    console.log(body_conekta);
    try {
      const suscribeConecta = await trpc.subscriptions.subscribeWithCardConekta.mutate(body_conekta);
      console.log(suscribeConecta);
      setShowSuccess(true);
      setLoader(false);
    } catch (error) {
      setErrorMessage('Verifique que los datos de su tarjeta sean los correctos!');
      setShow(true);
      setLoader(false);
    }
  }
  const paypalPayment = async (data: any) => {
    console.log(data);
  }
  const conektaErrorResponseHandler = (response: any) => {
    setErrorMessage('Verifique que los datos de su tarjeta sean los correctos!');
    setShow(true);
    setLoader(false);
  };
  const suscribetext = async () => {
    let body_stripe = {
      planId: plan.id,
      coupon: coupon,
    };
    setLoader(true);
    try {
      const suscribeMethod = await trpc.subscriptions.subscribeWithStripe.query(
        body_stripe
      );
      if (elements && stripe) {
        const result = await stripe.confirmCardPayment(
          suscribeMethod.clientSecret,
          {
            payment_method: {
              card: elements.getElement("card")!,
            },
          }
        );
        if (result.error) {
          setLoader(false);
          setErrorMessage(result.error.message);
          setShow(true);
        } else {
          setShowSuccess(true);
          setLoader(false);
        }
      }
    } catch (error) {
      setLoader(false);
      setShow(true);
      setErrorMessage(error);
    }
  };
  const onSubmit = async (e: any) => {
    e.preventDefault();
    if (random_number > 0) {
      suscribetext();
    } else {
      conectaSuscribe();
    }
  };
  // const public_key = "key_GexL0lNgQMi2Ugawb6Eefzp";

  useEffect(() => {
    // console.log(window.Conekta.setPublicKey(public_key));
    // window.Conekta.setPublicKey(public_key);
    console.log(plan);
  }, [plan]);

  return (
    <form className="checkout-form" onSubmit={onSubmit}>
      {/* <div className="c-row">
        <h4 className="mb-2">Have you a discount code?</h4>
        <input
          type="text"
          placeholder="Example CODE3232"
          onChange={(e) => setCoupon(e.target.value)}
        />
        <h4 className="mt-2">
          Discount only apply on first month. <span>Apply</span>
        </h4>
      </div> */}
      <div className="c-row">
        {random_number > 0 ? (
          <CardElement
            className="card-input"
            options={{ hidePostalCode: true }}
          />
        ) : (
          <div className="conekta-input">
            <input
              placeholder="Nombre en la tarjeta"
              onChange={(e) => {
                setCardInfo({
                  ...cardInfo,
                  name: e.target.value,
                });
              }}
            />
            <div className="bottom-inputs">
              <input
                placeholder="Número de tarjeta"
                type="number"
                onChange={(e) => {
                  setCardInfo({
                    ...cardInfo,
                    card: e.target.value,
                  });
                }}
              />
              <div className="other-inputs">
                <input
                  placeholder="mes"
                  type="numer"
                  onChange={(e) => {
                    setCardInfo({
                      ...cardInfo,
                      month: e.target.value,
                    });
                  }}
                />
                <input
                  placeholder="año"
                  type="number"
                  onChange={(e) => {
                    setCardInfo({
                      ...cardInfo,
                      year: e.target.value,
                    });
                  }}
                />
                <input
                  placeholder="cvv"
                  type="password"
                  onChange={(e) => {
                    setCardInfo({
                      ...cardInfo,
                      cvv: e.target.value,
                    });
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="button-contain">
        {loader ? (
          <Spinner size={4} width={0.4} color="#00e2f7" />
        ) : (
          <button className="btn primary-pill linear-bg">SUBSCRIBE</button>

        )}
        {/* {plan.id && <PayPalScriptProvider options={{
          clientId: "AYuKvAI09TE9bk9k1TuzodZ2zWQFpWEZesT65IkT4WOws9wq-yfeHLj57kEBH6YR_8NgBUlLShj2HOSr",
          vault: true,
        }} >
          <PayPalButtons
            style={{ color: "silver", shape: "pill", layout: "horizontal", height: 46 }}
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
            createSubscription={async (data, actions) => {
              try {
                const sub = await actions.subscription.create({
                  plan_id: plan.paypal_plan_id,
                });
                console.log(sub);
                return sub;
              } catch (e: any) {
                console.log(e?.message);
              }
              return "";
            }}
            onApprove={async (data: any, actions) => {
              const result = await trpc.subscriptions.subscribeWithPaypal.mutate({
                planId: plan.id,
                subscriptionId: data.subscriptionID
              })
              setShowSuccess(true);
              return data;
            }}
          />
        </PayPalScriptProvider>} */}
      </div>
      <ErrorModal show={show} onHide={closeError} message={errorMessage} />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        message="Gracias por tu pago, ya puedes empezar a descargar!"
        title="Compra Exitosa"
      />
    </form>
  );
}

export default CheckoutForm;
