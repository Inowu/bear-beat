import { IQuota } from "interfaces/User";
import "./SpaceAvailableCard.scss";
import { getCompleted, transformBiteToGb } from "../../functions/functions";

interface ISpaceAvailableCard {
  quota: IQuota;
}
function SpaceAvailableCard(props: ISpaceAvailableCard) {
  const { quota } = props;
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
    </div>
  );
}

export default SpaceAvailableCard;
