import "./CheckoutForm.scss";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import trpc from "../../api";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Spinner } from "../../components/Spinner/Spinner";
import { SuccessModal } from "../../components/Modals/SuccessModal/SuccessModal";
import { ErrorModal } from "../../components/Modals/ErrorModal/ErrorModal";
import { IPlans } from "interfaces/Plans";
import { useUserContext } from "../../contexts/UserContext";
import { IPaymentMethod } from "interfaces/User";
import { useFormik } from "formik";
import * as Yup from "yup";
import { FaCheck } from "react-icons/fa";
import { useCookies } from "react-cookie";
import { trackPurchase } from "../../utils/facebookPixel";
declare let window: any;

interface ICheckout {
  plan: IPlans;
  discount: number;
  setDiscount: (val: number) => void;
}

function CheckoutForm(props: ICheckout) {
  const { paymentMethods, cardLoad, getPaymentMethods, currentUser } = useUserContext();
  const [loader, setLoader] = useState<boolean>(false);
  const [coupon, setCoupon] = useState<string>("");
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [couponLoader, setCouponLoader] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const [card, setCard] = useState<any>(null);
  const { plan, setDiscount, discount } = props;
  const stripe = useStripe();
  const elements = useElements();
  const [cookies] = useCookies(['_fbp']);

  const navigate = useNavigate();
  const closeError = () => {
    setShow(false);
  };
  const closeSuccess = () => {
    setShowSuccess(false);
    navigate("/");
    window.location.reload();
  };
  const validationSchema = Yup.object().shape({
    code: Yup.string()
      .required("El código es requerido")
      .min(3, "Mínimo 3 caracteres"),
  });
  const initialValues = {
    code: "",
  };
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values, { setErrors }) => {
      setCouponLoader(true);
      try {
        const info = await trpc.cupons.findByCode.query({ code: values.code });
        setDiscount(info.discount);
      } catch (error: any) {
        setErrors({ code: error.message });
      }
      setCouponLoader(false);
    },
  });
  const {
    errors,
    touched,
    values: { code },
  } = formik;
  const suscribetext = async () => {
    let body_stripe = {
      planId: plan.id,
      coupon: code,
      fbp: cookies._fbp,
      url: window.location.href
    };
    setLoader(true);
    try {
      const suscribeMethod =
        await trpc.subscriptions.subscribeWithStripe.query(body_stripe);
      if (elements && stripe) {
        console.log(card);
        const result = await stripe.confirmCardPayment(
          suscribeMethod.clientSecret,
          card === null
            ? {
              payment_method: {
                card: elements.getElement("card")!,
              },
            }
            : {
              payment_method: card,
            }
        );
        getPaymentMethods();
        if (result.error) {
          setLoader(false);
          setErrorMessage(result.error.message);
          setShow(true);
        } else {
          if (currentUser) {
            trackPurchase({
              email: currentUser.email,
              phone: currentUser.phone,
              currency: "USD",
              value: plan?.price ?? 0,
            });
          }
          setShowSuccess(true);
          setLoader(false);
        }
      }
    } catch (error: any) {
      setLoader(false);
      setShow(true);
      setErrorMessage(error.message);
    }
  };
  const onSubmit = async (e: any) => {
    e.preventDefault();
    suscribetext();
  };
  return (
    <form className="checkout-form" onSubmit={onSubmit}>
      <div className="c-row">
        {cardLoad ? (
          <Spinner size={2} width={0.2} color="#00e2f7" />
        ) : (
          <>
            {card === null ? (
              <div className="icon-contain" onClick={() => setCard("")}>
                <p>Seleccionar tarjeta</p>
              </div>
            ) : (
              <div className="icon-contain" onClick={() => setCard(null)}>
                <p>Agregar nueva tarjeta</p>
              </div>
            )}
          </>
        )}
      </div>
      <div className="c-row">
        {card === null ? (
          <CardElement
            className="card-input"
            options={{ hidePostalCode: true }}
          />
        ) : (
          <select
            onChange={(e: any) => setCard(e.target.value)}
            defaultValue={""}
            style={{ color: "#fff" }}
          >
            <option disabled value={""}>
              Seleccione una tarjeta
            </option>
            {paymentMethods.map((card: IPaymentMethod, idx: number) => {
              return (
                <option value={card.id} key={"cards" + idx}>
                  {card.card.brand} termina en {card.card.last4}
                </option>
              );
            })}
          </select>
        )}
      </div>
      <div className="cupon-container">
        <input
          className="card-input"
          type="text"
          placeholder="Introduce el cupón aquí"
          name="code"
          id="code"
          value={code}
          onChange={formik.handleChange}
          disabled={discount > 0}
        />
        {couponLoader ? (
          <div className="loader-ctn">
            <Spinner size={3} width={0.3} color="#00e2f7" />
          </div>
        ) : (
          <>
            {discount > 0 ? (
              <div className="check-ctn">
                <FaCheck />
              </div>
            ) : (
              <button type="button" onClick={() => formik.handleSubmit()}>
                Aplicar
              </button>
            )}
          </>
        )}
        {touched.code && errors.code && <p className="error">{errors.code}</p>}
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
