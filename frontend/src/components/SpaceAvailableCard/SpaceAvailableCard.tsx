import { IQuota, IQuotaData } from "interfaces/User";
import "./SpaceAvailableCard.scss";
import { getCompleted, transformBiteToGb } from "../../functions/functions";

interface ISpaceAvailableCard {
  openPlan: ()=> void;
  quotaData: IQuotaData;
  type: string;
}
function SpaceAvailableCard(props: ISpaceAvailableCard) {
  const {  openPlan, quotaData, type } = props;
  const {used, available} = quotaData;
  const styles = {
    width: getCompleted(used, available) > 5 ? getCompleted(used, available)+"%" : "5%"
  }
  return (
    <div className="space-available-card ">
      <h2 className="title">
        { type === "extended" &&  "Gbs Adicionales: "}
        { type === "regular" &&  "Usado: "} <span>{getCompleted(used, available)}%</span>
      </h2>
      <h3>
        <span>{transformBiteToGb(used)}GB</span> de {transformBiteToGb(available)}GB
      </h3>
      <div className="progress-bar-container">
        <div className="progress-bar" style={styles} />
      </div>
      {
        getCompleted(used, available) >= 99 && type === "regular" &&
        <p className="extra-gb" onClick={openPlan}>¿Necesitas más espacio?</p>
      }
    </div>
  );
}

export default SpaceAvailableCard;
