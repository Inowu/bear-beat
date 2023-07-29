import "./CheckoutForm.scss";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

function CheckoutForm() {
  const onSubmit = (e: any) => {
    e.preventDefault();
  };
  return (
    <form className="checkout-form" onSubmit={onSubmit}>
      <div className="c-row">
        <h4 className="mb-2">Have you a discount code?</h4>
        <input type="text" placeholder="Example CODE3232" />
        <h4 className="mt-2">
          Discount only apply on first mont. <span>Apply</span>
        </h4>
      </div>
      <div className="c-row">
        <CardElement
          className="card-input"
          options={{ hidePostalCode: true }}
        />
      </div>
      <button className="btn primary-pill linear-bg">SUBSCRIBE</button>
    </form>
  );
}

export default CheckoutForm;
