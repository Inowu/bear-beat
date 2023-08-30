import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "../../components/CheckoutForm/CheckoutForm";
import "./Checkout.scss";
import { loadStripe } from "@stripe/stripe-js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useUserContext } from "../../contexts/UserContext";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { useLocation } from 'react-router-dom';
import { useEffect, useState } from "react";
import trpc from "../../api";
import { IPlans } from "interfaces/Plans";
const stripePromise = loadStripe(
  "pk_test_51JMhq9BL251ZjHC5HzwrIcNGdUplucqxgeAnIK7TtizDJnoofNIUoqO6JwkGQRADoSiRn2h1wCz2rVXgSjGN15Zz00or2Dw7zC"
);

function Checkout() {
  const [plan, setPlan] = useState({} as IPlans)
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const priceId = searchParams.get('priceId');
  const { currentUser } = useUserContext();
  const getPlans = async (id: any) => {
    const id_plan: any = +id;
    let body = {
      where: {
        activated: 1,
        id: id_plan,
      }
    }
    try{
      const plans: any = await trpc.plans.findManyPlans.query(body);
      setPlan(plans[0]);
    }
    catch(error){
      console.log(error);
    }

  }
  useEffect(() => {
    if(priceId){
      getPlans(priceId);
    }
  }, [priceId])
  return (
    <div className="checkout-main-container">
      <div className="checkout-card">
        <div className="payment-container">
          <h2>Billing information test</h2>
          <div className="order-info-container">
            <div className="c-row">
              <b>Order ID:</b>
              <p>7608</p> 
            </div>
            <div className="c-row">
              <b>Name: </b>
              <p>{currentUser?.username}</p>
            </div>
            <div className="c-row">
              <b>E-mail</b>
              <p>{currentUser?.email}</p>
            </div>
          </div>
          <Elements stripe={stripePromise}>
            <CheckoutForm plan={plan.id}/>
          </Elements>
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
              <b>${plan.price}.00 {plan.moneda}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Checkout;
