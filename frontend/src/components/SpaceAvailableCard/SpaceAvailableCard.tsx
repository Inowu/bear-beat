import { IQuota, IQuotaData } from "interfaces/User";
import "./SpaceAvailableCard.scss";
import { getCompleted, transformBiteToGb } from "../../functions/functions";
import { Link } from "react-router-dom";

interface ISpaceAvailableCard {
  openPlan: () => void;
  quotaData: IQuotaData;
  type: string;
}
function SpaceAvailableCard(props: ISpaceAvailableCard) {
  const { openPlan, quotaData, type } = props;
  const { used, available } = quotaData;
  const styles = {
    width:
      getCompleted(used, available) > 5
        ? getCompleted(used, available) + "%"
        : "5%",
  };
  return (
    <div className="space-available-card ">
      <h2 className="title">
        {type === "extended" && "Gbs Adicionales: "}
        {type === "regular" && "Usado: "}{" "}
        <span>{getCompleted(used, available)}%</span>
      </h2>
      <h3>
        <span>{transformBiteToGb(used)}GB</span> de{" "}
        {transformBiteToGb(available)}GB
      </h3>
      <div className="progress-bar-container">
        <div className="progress-bar" style={styles} />
      </div>
      {getCompleted(used, available) >= 99 && type === "regular" && (
        <p className="extra-gb" onClick={openPlan}>
          ¿Necesitas más espacio?
        </p>
      )}
      {type === "regular" && (
        <div className="bottom-options">
          {/* <b>Descargas en total</b> */}
          {/* <p>
            {"15"}
            {" audios"}
          </p> */}
          <Link to={"/descargas"} className="button">
            Ver historial de descargas
          </Link>
        </div>
      )}
    </div>
  );
}

export default SpaceAvailableCard;
