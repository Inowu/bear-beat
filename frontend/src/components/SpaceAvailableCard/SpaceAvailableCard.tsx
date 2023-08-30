import { IQuota } from "interfaces/User";
import "./SpaceAvailableCard.scss";

interface ISpaceAvailableCard {
  quota: IQuota;
}
function SpaceAvailableCard(props: ISpaceAvailableCard) {
  const { quota } = props;
  const { used, available } = quota;
  const styles = {
    width: available === 0 ? "5%" : ((used/available*100) > 5 ? ((used/available)*100)+"%" : "5%"),
  }
  return (
    <div className="space-available-card">
      <h2 className="title">
        Usado: <span>{available === 0 ? 0 : ((used/available)*100)}%</span>
      </h2>
      <h3>
        <span>{used}GB</span> de {available}GB
      </h3>
      <div className="progress-bar-container">
        <div className="progress-bar" style={styles}/>
      </div>
    </div>
  );
}

export default SpaceAvailableCard;
