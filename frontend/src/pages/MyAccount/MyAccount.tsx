import "./MyAccount.scss";
import Logo from "../../assets/images/osonuevo.png";
import Visa from "../../assets/images/cards/visa.png";
import Mastercard from "../../assets/images/cards/master.png";
import Amex from "../../assets/images/cards/express.png";
import { Link } from "react-router-dom";
import filezillaIcon from "../../assets/images/filezilla_icon.png";
import SpaceAvailableCard from "../../components/SpaceAvailableCard/SpaceAvailableCard";
import { useUserContext } from "../../contexts/UserContext";
import { useEffect, useState } from "react";
import trpc from "../../api";
import { IOrders, IPaymentMethod, IQuota, IUser_downloads } from "interfaces/User";
import { ConditionModal } from "../../components/Modals/ConditionModal/ContitionModal";
import { ErrorModal } from "../../components/Modals/ErrorModal/ErrorModal";
import { SuccessModal } from "../../components/Modals/SuccessModal/SuccessModal";
import { PaymentMethodModal } from "../../components/Modals/PaymentMethodModal/PaymentMethodModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClose, faP, faPlus, faPlusCircle, faTrash } from "@fortawesome/free-solid-svg-icons";
import { Spinner } from "../../components/Spinner/Spinner";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
const stripePromise = loadStripe(
  "pk_live_51HxCA5INxJoHjyCFl7eC2fUI9S22i2NW8iMnAjrvAUjnuVGZedLSRxB3sZspZzzHNOoTCNwgUNoZEYfXQuF6VvBV00MJ2C2k9s"
);

function MyAccount() {
  const { currentUser, startUser } = useUserContext();
  const [quota, setQuota] = useState({} as IQuota)
  const [orders, setOrders] = useState<IOrders[]>([]);
  const [showCondition, setShowCondition] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [conditionMessage, setConditionMessage] = useState("");
  const [conditionTitle, setConditionTitle] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<IPaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<any>();
  const [condition, setCondition] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const closeCondition = () => {
    setShowCondition(false);
  }
  const openCondition = () => {
    setShowCondition(true);
  }
  const closeSuccess = () => {
    setShowSuccess(false);
  }
  const closeError = () => {
    setShowError(false);
  }
  const startCancel = () => {
    setConditionTitle('Cancelación de suscripción')
    setConditionMessage('¿Estás seguro que quieres cancelar tu suscripción?')
    openCondition();
    setCondition(1);
  }
  const changeDefaultCard = () => {
    setConditionTitle('Cambiar por Predeterminado')
    setConditionMessage('¿Estás seguro que quieres cambiar tu tarjeta predeterminada?')
    openCondition();
    setCondition(2);
  }
  const deletePaymentMethod = () => {
    setConditionTitle('Eliminar método de pago')
    setConditionMessage('¿Estás seguro que quieres eliminar este método de pago?')
    openCondition();
    setCondition(3);
  }
  const finishSubscription = async () => {
    closeCondition();
    try {
      const cancelSuscription: any = await trpc.subscriptions.requestSubscriptionCancellation.mutate()
      startUser();
      setShowSuccess(true);
    }
    catch (error) {
      setShowError(true);
      console.log(error);
    }
  }
  const changeDefault = async () => {
    console.log('default');
    try {

    }
    catch (error) {

    }
  }
  const deleteCard = async () => {

    try {
      if (paymentMethod) {
        const cards: any = await trpc.subscriptions.removeStripeCard.mutate({ paymentMethodId: paymentMethod.id });
        getPaymentMethods();
        closeCondition();
      }
    }
    catch (error) {

    }
  }
  const getPaymentMethods = async () => {
    setIsLoading(true);
    try {
      const cards: any = await trpc.subscriptions.listStripeCards.query();
      setPaymentMethods(cards.data);
      setIsLoading(false);
    }
    catch (error) {
      console.log(error);
    }
  }
  const getQuota = async () => {
    try {
      const quota: any = await trpc.ftp.quota.query();
      setQuota(quota);
    }
    catch (error) {
      console.log(error);
    }
  }
  const getOrders = async () => {
    let body = {

    }
    try {
      const user_downloads: any = await trpc.descargasuser.ownDescargas.query(body);
      let allorders: any = [];
      await Promise.all(user_downloads.map(async (orders: any) => {
        let order_body = {
          where: {
            id: orders.order_id,
          }
        }
        const order: any = await trpc.orders.ownOrders.query(order_body);
        if (order.length > 0) {
          allorders.push(order[0]);
        }
      }))
      setOrders(allorders);
      // const order:any = await trpc.orders.ownOrders.query(body); 
      // setOrders(order);
    }
    catch (error) {
      console.log(error);
    }
  }

  const handlePaymentMethod = (value: boolean) => {
    let error = value;
    if (!error) {
      setShowPaymentMethod(false); getPaymentMethods();
    } else {
      setShowPaymentMethod(false);
      setShowError(true);
    }
  }

  useEffect(() => {
    getQuota();
    getOrders();
    // getPaymentMethods();
  }, [])

  return (
    <div className="my-account-main-container">
      <div className="general">
        <div className="user-profile-pic">
          <img src={currentUser?.profileImg ? currentUser.profileImg : Logo} alt="profile pic" />
        </div>
        <h2>Información general</h2>
        <div className="user-info-container">
          <div className="c-row">
            <b>Username</b>
            <p>{currentUser?.username}</p>
          </div>
          <div className="c-row">
            <b>E-mail</b>
            <p>{currentUser?.email}</p>
          </div>
          <div className="c-row">
            <b>Phone</b>
            <p>{currentUser?.phone}</p>
          </div>
        </div>
        {true && <SpaceAvailableCard quota={quota} />}
        {/* {
          currentUser?.hasActiveSubscription && !currentUser.isSubscriptionCancelled &&
          <button className="cancel" onClick={startCancel}>CANCELAR SUSCRIPCION</button>
        } */}
      </div>
      <div className="purchase">
        <div className="actives-ftp-container">
          <h2>MI USUARIO FTP ACTIVO</h2>
          {true ? (
            <table className="table table-responsive">
              <thead>
                <tr>
                  <th scope="col">Host</th>
                  <th scope="col">Username</th>
                  <th scope="col">Password</th>
                  <th scope="col">Port</th>
                  <th scope="col">Expiración</th>
                  <th scope="col"> </th>
                </tr>
              </thead>
              <tbody>
                {
                  currentUser?.ftpAccount ?
                    <tr>
                      <td>{currentUser?.ftpAccount.host}</td>
                      <td>{currentUser?.ftpAccount.userid}</td>
                      <td>{currentUser?.ftpAccount.passwd}</td>
                      <td>{currentUser?.ftpAccount.port}</td>
                      <td>{currentUser?.ftpAccount.expiration.toDateString()}</td>
                      <td>
                        <img src={filezillaIcon} alt="filezilla" />
                      </td>
                    </tr> :
                    <tr />
                }

              </tbody>
            </table>
          ) : (
            <div className="no-items-container">
              <p>
                Aún no has comprado un plan,{" "}
                <Link to={"/planes"}>click aquí</Link> para que vayas a comprar
                uno.
              </p>
            </div>
          )}
        </div>
        <div className="last-purchased">
          <h2>Últimas compras</h2>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Orden #</th>
                <th scope="col">Precio</th>
              </tr>
            </thead>
            <tbody>
              {orders.length > 0 ? (
                orders.map((order: IOrders, index: number) => {
                  return (
                    <tr key={"order_" + index}>
                      <td>{order.date_order.toDateString()}</td>
                      <td>{order.id}</td>
                      <td>${order.total_price}.00 {order.total_price === 18 ? "USD" : "MXN"}</td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td className="pt-4" colSpan={3}>
                    <h2 className="text-center">
                      No existen ultimas compras en su historial.
                    </h2>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* <div className="actives-ftp-container cards">
          <h2>Tarjetas</h2>
          {!isLoading ?
            paymentMethods.map((x: any) => {
              return (
                <div className="card">
                  <div className="circle">
                    <img src={x.card.brand === "visa" ? Visa : x.card.brand === "mastercard" ? Mastercard : Amex} alt="" />
                  </div>
                  <p>Termina en {x.card.last4}</p>
                  <p>{x.card.exp_month}/{x.card.exp_year}</p>
                  <FontAwesomeIcon icon={faTrash} onClick={() => { deletePaymentMethod(); setPaymentMethod(x); }} />
                </div>
              )
            }) :
            <Spinner size={4} width={0.4} color="#00e2f7" />
          }
          <p className="new" onClick={() => setShowPaymentMethod(!showPaymentMethod)}>Agregar nueva tarjeta</p>
        </div> */}
      </div>
      <ErrorModal
        show={showError}
        onHide={closeError}
        message={"Ha habido un error"}
      />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        message="Su suscripción se ha cancelado con éxito."
        title="Suscripción Cancelada"
      />
      <Elements stripe={stripePromise}>

        <PaymentMethodModal
          show={showPaymentMethod}
          onHide={handlePaymentMethod}
          message=""
          title="Ingresa una nueva tarjeta"
        />
      </Elements>
      <ConditionModal
        title={conditionTitle}
        message={conditionMessage}
        show={showCondition}
        onHide={closeCondition}
        action={
          condition === 1 ? finishSubscription
            : (condition === 2 ? changeDefault : deleteCard)
        }
      />
    </div>
  );
}

export default MyAccount;
