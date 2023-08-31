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
  const stripe:any = useStripe();
  const elements:any = useElements();
  const random_number: number = Math.random();
  const navigate = useNavigate();
  const suscribetext = async (token: any) => {
    let body_conekta = {
      cardToken: token.id,
      planId: plan,
    }
    let body_stripe = {
      // cardToken: token.id,
      planId: plan,
      coupon: coupon,
    }
    console.log(body_stripe);
    setLoader(true);
    try{
      // if(random_number > .5){
      //   const suscribeMethod = await trpc.subscriptions.subscribeWithCardConekta.mutate(body_conekta);
      //   console.log(suscribeMethod);
      // }else{
        const suscribeMethod = await trpc.subscriptions.subscribeWithStripe.query(body_stripe)
        setLoader(false);
        navigate('/');
      // }
    }
    catch(error){
      setLoader(false);
      alert(error);
      console.log(error)
    }
  }
  const onSubmit = async(e: any) => {
    e.preventDefault();
    const cardElement = elements.getElement(CardElement);
    const { token, error } = await stripe.createToken(cardElement);
    if(token){
      suscribetext(token);
    }
    if(error){
      console.log(error);
    }

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
