import "./CheckoutForm.scss";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import trpc from "../../api";
import { visitFunctionBody } from "typescript";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Spinner } from "../../components/Spinner/Spinner";
import { SuccessModal } from "../../components/Modals/SuccessModal/SuccessModal";
import { ErrorModal } from "../../components/Modals/ErrorModal/ErrorModal";
import { IPlans } from "interfaces/Plans";
import { useUserContext } from "../../contexts/UserContext";
import { IPaymentMethod } from "interfaces/User";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle, faPlugCircleCheck, faPlusCircle } from "@fortawesome/free-solid-svg-icons";
declare let window: any;

interface ICheckout {
  plan: IPlans;
}

function CheckoutForm(props: ICheckout) {
  const { paymentMethods, cardLoad, getPaymentMethods } = useUserContext();
  const [loader, setLoader] = useState<boolean>(false);
  const [coupon, setCoupon] = useState<string>("");
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const [card, setCard] = useState<any>(null);
  const { plan } = props;
  const stripe: any = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const closeError = () => {
    setShow(false);
  };
  const closeSuccess = () => {
    setShowSuccess(false);
    navigate("/");
    window.location.reload();
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
        console.log(card);
        const result = await stripe.confirmCardPayment(
          suscribeMethod.clientSecret,
          card === null ?
          {
            payment_method: {
              card: elements.getElement("card")!,
            },
          }
          : {
            payment_method: card
          }
        );
        getPaymentMethods();
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
      console.log(error);
      setLoader(false);
      setShow(true);
      setErrorMessage(error);
    }
  };
  const onSubmit = async (e: any) => {
    e.preventDefault();
    suscribetext();
  };
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
        {
          cardLoad
          ? <Spinner size={2} width={0.2} color="#00e2f7" />
          :
          <>
          {
            card === null 
            ?
            <div className="icon-contain" onClick={()=> setCard("")}>
              <p>Seleccionar tarjeta</p>
            </div>
            :          
            <div className="icon-contain" onClick={()=> setCard(null)}>
              <p>Agregar nueva tarjeta</p>
            </div>
          }
          </>
        }
      </div>
      <div className="c-row">
        {
          card === null ?
          <CardElement
            className="card-input"
            options={{ hidePostalCode: true }}
          />
          :
          <select onChange={(e:any)=> setCard(e.target.value)} defaultValue={''}>
          <option disabled value={''}>Seleccione una tarjeta</option>
          {
            paymentMethods.map((card: IPaymentMethod, idx: number)=>{
              return (
                <option value={card.id} key={"cards" + idx}>{card.card.brand} termina en {card.card.last4}</option>
              )
            })
          }
        </select>
        }
      </div>
      <div className="button-contain">
        {loader ? (
          <Spinner size={4} width={0.4} color="#00e2f7" />
        ) : (
          <button className="btn primary-pill linear-bg">SUBSCRIBE</button>

        )}
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
