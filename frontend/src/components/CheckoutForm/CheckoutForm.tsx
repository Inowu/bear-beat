import "./CheckoutForm.scss";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import trpc from "../../api";
import { visitFunctionBody } from "typescript";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Spinner } from "../../components/Spinner/Spinner";
import { SuccessModal } from "../../components/Modals/SuccessModal/SuccessModal";
import { ErrorModal } from "../../components/Modals/ErrorModal/ErrorModal";

interface ICheckout {
  plan: number;
}

function CheckoutForm(props: ICheckout) {
  const [loader, setLoader] = useState<boolean>(false);
  const [coupon, setCoupon] = useState<string>('');
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>('');
  const { plan } = props;
  const stripe: any = useStripe();
  const elements = useElements();
  const random_number: number = Math.random();
  const navigate = useNavigate();
  const closeError = () => {
    setShow(false);
  }
  const closeSuccess = () => {
    setShowSuccess(false);
    navigate('/');
    window.location.reload();
  }
  const suscribetext = async () => {
    let body_stripe = {
      // cardToken: token.id,
      planId: plan,
      coupon: coupon,
    }
    setLoader(true);
    try{
        const suscribeMethod = await trpc.subscriptions.subscribeWithStripe.query(body_stripe)
        if (elements && stripe) {
          const result = await stripe.confirmCardPayment(suscribeMethod.clientSecret, {
            payment_method: {
              card: elements.getElement("card")!,
            },
          });
          if(result.error){
            setLoader(false);
            setErrorMessage(result.error.message);
            setShow(true);
          }else{
            setShowSuccess(true);
            setLoader(false);
          }
        }
    }
    catch(error){
      setLoader(false);
      setShow(true);
      setErrorMessage(error);
    }
  }
  const onSubmit = async(e: any) => {
    e.preventDefault();
    suscribetext();
  };

  return (
    <form className="checkout-form" onSubmit={onSubmit}>
      <div className="c-row">
        <h4 className="mb-2">Have you a discount code?</h4>
        <input type="text" placeholder="Example CODE3232" onChange={(e)=>setCoupon(e.target.value)} />
        <h4 className="mt-2">
          Discount only apply on first month. <span>Apply</span>
        </h4>
      </div>
      <div className="c-row">
        <CardElement
          className="card-input"
          options={{ hidePostalCode: true }}
        />
      </div>
      {
        loader 
        ? <Spinner size={4} width={.4} color="#00e2f7"/>
        : <button className="btn primary-pill linear-bg">SUBSCRIBE</button>
      }
           <ErrorModal show={show} onHide={closeError} message={errorMessage}/>
           <SuccessModal show={showSuccess} onHide={closeSuccess} message= "Gracias por tu pago, ya puedes empezar a descargar!" title ="Compra Exitosa"/> 
    </form>
  );
}

export default CheckoutForm;
