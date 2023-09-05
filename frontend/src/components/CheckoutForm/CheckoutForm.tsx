import "./CheckoutForm.scss";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import trpc from "../../api";
import { visitFunctionBody } from "typescript";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Spinner } from "../../components/Spinner/Spinner";

interface ICheckout {
  plan: number;
}

function CheckoutForm(props: ICheckout) {
  const [loader, setLoader] = useState<boolean>(false);
  const [coupon, setCoupon] = useState<string>('');
  const { plan } = props;
  const stripe: any = useStripe();
  const elements = useElements();
  const random_number: number = Math.random();
  const navigate = useNavigate();

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
            alert(result.error.message);
            console.log(result.error.message);
          }else{
            alert('Gracias por tu pago, ya puedes descargar!')
            setLoader(false);
            navigate('/');
            window.location.reload();
          }
        }
    }
    catch(error){
      setLoader(false);
      alert(error);
      console.log(error)
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
      
    </form>
  );
}

export default CheckoutForm;
