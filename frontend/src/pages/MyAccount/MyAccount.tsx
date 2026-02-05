import "./MyAccount.scss";
import { ConditionModal, ErrorModal, PaymentMethodModal, PlansModal, SuccessModal } from "../../components/Modals"
import { Elements } from "@stripe/react-stripe-js";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getCompleted } from "../../functions/functions";
import { IOrders, IQuota, IFtpAccount } from "interfaces/User";
import { Link } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { saveAs } from 'file-saver';
import { Spinner } from "../../components/Spinner/Spinner";
import { useEffect, useState } from "react";
import { useUserContext } from "../../contexts/UserContext";
import Amex from "../../assets/images/cards/express.png";
import filezillaIcon from "../../assets/images/filezilla_icon.png";
import Logo from "../../assets/images/osonuevo.png";
import Mastercard from "../../assets/images/cards/master.png";
import SpaceAvailableCard from "../../components/SpaceAvailableCard/SpaceAvailableCard";
import trpc from "../../api";
import Visa from "../../assets/images/cards/visa.png";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";

const stripeKey = process.env.REACT_APP_ENVIRONMENT === 'development'
  ? process.env.REACT_APP_STRIPE_TEST_KEY as string
  : process.env.REACT_APP_STRIPE_KEY as string

const stripePromise = loadStripe(stripeKey);

function MyAccount() {
  useEffect(() => { trackManyChatConversion(MC_EVENTS.VIEW_MY_ACCOUNT); }, []);
  const {
    currentUser,
    startUser,
    paymentMethods,
    cardLoad,
    getPaymentMethods,
  } = useUserContext();
  const [quota, setQuota] = useState({} as IQuota);
  const [orders, setOrders] = useState<IOrders[]>([]);
  const [showCondition, setShowCondition] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTitle, setSuccessTitle] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<any>();
  const [conditionMessage, setConditionMessage] = useState("");
  const [conditionTitle, setConditionTitle] = useState("");
  const [condition, setCondition] = useState(0);
  const [showPlan, setShowPlan] = useState<boolean>(false);
  const closeCondition = () => {
    setShowCondition(false);
  };
  const openCondition = () => {
    setShowCondition(true);
  };
  const closeSuccess = () => {
    setShowSuccess(false);
  };
  const closeError = () => {
    setShowError(false);
  };
  const closePlan = () => {
    setShowPlan(false);
  };
  const openPlan = () => {
    setShowPlan(true);
  };
  const startCancel = () => {
    setConditionTitle("Cancelación de suscripción");
    setConditionMessage("¿Estás seguro que quieres cancelar tu suscripción?");
    openCondition();
    setCondition(1);
  };
  const deletePaymentMethod = () => {
    setConditionTitle("Eliminar método de pago");
    setConditionMessage(
      "¿Estás seguro que quieres eliminar este método de pago?"
    );
    openCondition();
    setCondition(3);
  };
  const finishSubscription = async () => {
    closeCondition();
    try {
      await trpc.subscriptions.requestSubscriptionCancellation.mutate();
      startUser();
      setShowSuccess(true);
      setSuccessMessage("Su suscripción se ha cancelado con éxito.");
      setSuccessTitle("Suscripción Cancelada");
    } catch (error) {
      setErrorMessage("Ha habido un error");
      setShowError(true);
      console.log(error);
    }
  };
  const changeDefault = async () => {
    console.log("default");
    try {
    } catch (error) { }
  };
  const deleteCard = async () => {
    try {
      if (paymentMethod) {
        await trpc.subscriptions.removeStripeCard.mutate({
          paymentMethodId: paymentMethod.id,
        });
        getPaymentMethods();
        closeCondition();
      }
    } catch (error) { }
  };
  const getQuota = async () => {
    if (currentUser !== null) {
      let body: any = {
        isExtended: currentUser.extendedFtpAccount,
      };
      try {
        const quota: any = await trpc.ftp.quota.query(body);
        if (getCompleted(quota.used, quota.available) >= 99) {
          openPlan();
        }
        setQuota(quota);
      } catch (error) {
        console.log(error);
      }
    }
  };
  const getOrders = async () => {
    let body = {};
    try {
      const user_downloads: any =
        await trpc.descargasuser.ownDescargas.query(body);

      let allorders: any = [];
      await Promise.all(
        user_downloads.map(async (orders: any) => {
          if (orders.order_id) {
            let order_body = {
              where: {
                id: orders.order_id,
              },
            };
            const order: any = await trpc.orders.ownOrders.query(order_body);
            if (order.length > 0) {
              allorders.push(order[0]);
            }
          }
        })
      );
      setOrders(allorders);
      // const order:any = await trpc.orders.ownOrders.query(body);
      // setOrders(order);
    } catch (error: any) {
      console.log(error.message);
    }
  };

  const handlePaymentMethod = (value: boolean) => {
    let error = value;
    if (!error) {
      setShowPaymentMethod(false);
      getPaymentMethods();
    } else {
      setShowPaymentMethod(false);
      setShowError(true);
      setErrorMessage("Ha habido un error");
    }
  };

  const downloadXMLFile = (ftpAccount: IFtpAccount) => {
    const { host, passwd, port, userid } = ftpAccount;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <FileZilla3>
        <Servers>
          <Server>
            <Host>${host}</Host>
            <Port>${port}</Port>
            <Protocol>0</Protocol>
            <Type>0</Type>
            <User>${userid}</User>
            <Pass>${passwd}</Pass>
            <Logontype>1</Logontype>
            <EncodingType>UTF-8</EncodingType>
            <TimezoneOffset>0</TimezoneOffset>
            <PasvMode>MODE_DEFAULT</PasvMode>
            <MaximumMultipleConnections>0</MaximumMultipleConnections>
            <EncodingType>Auto</EncodingType>
            <BypassProxy>0</BypassProxy>
            <Name>Bear Beat FTP</Name>
            <Comments>Home: https://thebearbeat.com/</Comments>
            <LocalDir/>
            <RemoteDir/>
            <SyncBrowsing>0</SyncBrowsing>
          </Server>
        </Servers>
      </FileZilla3>`;
    const blob = new Blob([xml], { type: 'text/xml' });
    saveAs(blob, 'bearbeat.xml');
  }

  useEffect(() => {
    if (currentUser) {
      getQuota();
      getOrders();
    }
  }, [currentUser]);
  return (
    <div className="my-account-main-container">
      <div className="general">
        <div className="user-profile-pic">
          <img
            src={currentUser?.profileImg ? currentUser.profileImg : Logo}
            alt="profile pic"
          />
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
        {quota.regular && (
          <SpaceAvailableCard
            quotaData={quota.regular}
            openPlan={openPlan}
            type="regular"
          />
        )}
        {currentUser?.extendedFtpAccount !== undefined && quota.extended && (
          <SpaceAvailableCard
            quotaData={quota.extended}
            openPlan={openPlan}
            type="extended"
          />
        )}
        {currentUser?.hasActiveSubscription &&
          !currentUser.isSubscriptionCancelled && (
            <button className="cancel" onClick={startCancel}>
              CANCELAR SUSCRIPCION
            </button>
          )}
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
                {currentUser?.ftpAccount ? (
                  <tr>
                    <td>{currentUser?.ftpAccount.host}</td>
                    <td>{currentUser?.ftpAccount.userid}</td>
                    <td>{currentUser?.ftpAccount.passwd}</td>
                    <td>{currentUser?.ftpAccount.port}</td>
                    <td>{currentUser?.ftpAccount.expiration.toDateString()}</td>
                    <td onClick={() => downloadXMLFile(currentUser?.ftpAccount!)}>
                      <img src={filezillaIcon} alt="filezilla" />
                    </td>
                  </tr>
                ) : (
                  <tr />
                )}
                {currentUser?.extendedFtpAccount !== undefined &&
                  currentUser?.extendedFtpAccount &&
                  currentUser?.ftpAccount ? (
                  <tr>
                    <td>{currentUser?.ftpAccount.host}</td>
                    <td>{currentUser?.extendedFtpAccount.userid}</td>
                    <td>{currentUser?.extendedFtpAccount.passwd}</td>
                    <td>{currentUser?.ftpAccount.port}</td>
                    <td>{ }</td>
                    <td>
                      <img src={filezillaIcon} alt="filezilla" />
                    </td>
                  </tr>
                ) : (
                  <tr />
                )}
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
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length > 0 ? (
                orders.map((order: IOrders, index: number) => {
                  return (
                    <tr key={"order_" + index}>
                      <td>{order.date_order.toDateString()}</td>
                      <td>{order.id}</td>
                      <td>
                        ${order.total_price}.00{" "}
                      </td>
                      <td>
                        {order.status === 0 && "Pendiente"}
                        {order.status === 1 && "Pagada"}
                        {order.status === 2 && "Fallida"}
                        {order.status === 3 && "Cancelada"}
                        {order.status === 4 && "Expirada"}
                      </td>
                    </tr>
                  );
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
        <div className="actives-ftp-container cards">
          <h2>Tarjetas</h2>
          {!cardLoad ? (
            paymentMethods.map((x: any, index: number) => {
              return (
                <div className="card" key={"cards_" + index}>
                  <div className="circle">
                    <img
                      src={
                        x.card.brand === "visa"
                          ? Visa
                          : x.card.brand === "mastercard"
                            ? Mastercard
                            : Amex
                      }
                      alt=""
                    />
                  </div>
                  <p>Termina en {x.card.last4}</p>
                  <p>
                    {x.card.exp_month}/{x.card.exp_year}
                  </p>
                  <FontAwesomeIcon
                    icon={faTrash}
                    onClick={() => {
                      deletePaymentMethod();
                      setPaymentMethod(x);
                    }}
                  />
                  {/* {
                    x.customer === currentUser?.stripeCusId && 
                    <p>Predeterminada</p>
                  } */}
                </div>
              );
            })
          ) : (
            <Spinner size={4} width={0.4} color="#00e2f7" />
          )}
          <p
            className="new"
            onClick={() => setShowPaymentMethod(!showPaymentMethod)}
          >
            Agregar nueva tarjeta
          </p>
        </div>
      </div>
      <ErrorModal show={showError} onHide={closeError} message={errorMessage} />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        message={successMessage}
        title={successTitle}
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
          condition === 1
            ? finishSubscription
            : condition === 2
              ? changeDefault
              : deleteCard
        }
      />
      <Elements stripe={stripePromise}>
        <PlansModal
          show={showPlan}
          onHide={closePlan}
          dataModals={{
            setShowError: setShowError,
            setShowSuccess: setShowSuccess,
            setSuccessMessage: setSuccessMessage,
            setErrorMessage: setErrorMessage,
            setSuccessTitle: setSuccessTitle,
          }}
        />
      </Elements>
    </div>
  );
}

export default MyAccount;
