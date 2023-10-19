import "./MyAccount.scss";
import Logo from "../../assets/images/osonuevo.png";
import { Link } from "react-router-dom";
import filezillaIcon from "../../assets/images/filezilla_icon.png";
import SpaceAvailableCard from "../../components/SpaceAvailableCard/SpaceAvailableCard";
import { useUserContext } from "../../contexts/UserContext";
import { useEffect, useState } from "react";
import trpc from "../../api";
import { IOrders, IQuota, IUser_downloads } from "interfaces/User";
import { ConditionModal } from "../../components/Modals/ConditionModal/ContitionModal";
import { ErrorModal } from "../../components/Modals/ErrorModal/ErrorModal";
import { SuccessModal } from "../../components/Modals/SuccessModal/SuccessModal";

function MyAccount() {
  const { currentUser } = useUserContext();
  const [quota, setQuota] = useState({} as IQuota)
  const [orders, setOrders] = useState<IOrders[]>([]);
  const [showCondition, setShowCondition] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const closeCondition =() => {
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
  console.log(currentUser);
  const cancelAction = async () => {
    try{
      // const cancelStripe = trpc.subscriptions.cancelStripeSubscription.mutate();
      // const cancelPaypal = trpc.subscriptions.cancelPaypalSubscription.mutate();
    }
    catch(error){
      setShowError(true);
      console.log(error);
    }
  }
  const getQuota = async () => {
    try{
      const quota: any = await trpc.ftp.quota.query();
      setQuota(quota);
    }
    catch(error){
      console.log(error);
    }
  }
  const getOrders = async () => {
    let body = {

    }
    try{
      const user_downloads:any = await trpc.descargasuser.ownDescargas.query(body);
      let allorders:any = [] ;
      await Promise.all(user_downloads.map(async (orders: any)=>{
        let order_body = {
          where: {
            id: orders.order_id,
          }
        }
        const order:any = await trpc.orders.ownOrders.query(order_body);
        if (order.length> 0) {
          allorders.push(order[0]);
        }
      }))
      setOrders(allorders);
      // const order:any = await trpc.orders.ownOrders.query(body); 
      // setOrders(order);
    }
    catch(error){
      console.log(error);
    }
  }
  useEffect(() => {
    getQuota();
    getOrders();
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
        {true && <SpaceAvailableCard quota={quota}/>}
        {/* <button className="cancel" onClick={openCondition}>CANCERLAR SUSCRIPCION</button> */}
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
                </tr>:
                <tr/>
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
                orders.map((order: IOrders, index: number)=>{
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
      </div>
      <ErrorModal 
        show={showError} 
        onHide={closeError} 
        message={"Ha habido un error"}
      />
      <SuccessModal 
        show={showSuccess} 
        onHide={closeSuccess} 
        message= "Revise las instrucciones en su correo para realizar el cambio de contraseña" 
        title ="Correo enviado!"
      /> 
      <ConditionModal
          title="Cancelación de suscripción"
          message="¿Estás seguro que quieres cancelar tu suscripción?"
          show={showCondition}
          onHide={closeCondition}
          action={cancelAction}
      />
    </div>
  );
}

export default MyAccount;
