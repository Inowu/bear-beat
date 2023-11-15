import { IQuota } from "interfaces/User";
import "./SpaceAvailableCard.scss";
import { getCompleted, transformBiteToGb } from "../../functions/functions";

interface ISpaceAvailableCard {
  quota: IQuota;
  openPlan: ()=> void;
}
function SpaceAvailableCard(props: ISpaceAvailableCard) {
  const { quota, openPlan } = props;
  const { used, available } = quota;
  const styles = {
    width: getCompleted(used, available) > 5 ? getCompleted(used, available)+"%" : "5%"
  }
  return (
    <div className="space-available-card">
      <h2 className="title">
        Usado: <span>{getCompleted(used, available)}%</span>
      </h2>
      <h3>
        <span>{transformBiteToGb(used)}GB</span> de {transformBiteToGb(available)}GB
      </h3>
      <div className="progress-bar-container">
        <div className="progress-bar" style={styles} />
      </div>
      {/* {
        getCompleted(used, available) >= 99 &&
        <p className="extra-gb" onClick={openPlan}>¿Necesitas más espacio?</p>
      } */}
    </div>
  );
}

export default SpaceAvailableCard;
