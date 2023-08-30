import "./MyAccount.scss";
import Logo from "../../assets/images/osonuevo.png";
import { Link } from "react-router-dom";
import filezillaIcon from "../../assets/images/filezilla_icon.png";
import SpaceAvailableCard from "../../components/SpaceAvailableCard/SpaceAvailableCard";
import { useUserContext } from "../../contexts/UserContext";
import { useEffect, useState } from "react";
import trpc from "../../api";
import { IQuota } from "interfaces/User";

function MyAccount() {
  const { currentUser } = useUserContext();
  const [quota, setQuota] = useState({} as IQuota)
  const getQuota = async () => {
    try{
      const quota: any = await trpc.ftp.quota.query();
      setQuota(quota);
    }
    catch(error){
      console.log(error);
    }
  }

  useEffect(() => {
    getQuota();
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
                <tr>
                  <td>51.222.40.65</td>
                  <td>kevinwoolfolk</td>
                  <td>123</td>
                  <td>21</td>
                  <td>20 Jul, 2023</td>
                  <td>
                    <img src={filezillaIcon} alt="filezilla" />
                  </td>
                </tr>
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
              {false ? (
                <>
                  <tr>
                    <td>Mark</td>
                    <td>Otto</td>
                    <td>@mdo</td>
                  </tr>
                  <tr>
                    <td>Jacob</td>
                    <td>Thornton</td>
                    <td>@fat</td>
                  </tr>
                </>
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
    </div>
  );
}

export default MyAccount;
