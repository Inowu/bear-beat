import "./SpaceAvailableCard.scss";

function SpaceAvailableCard() {
  return (
    <div className="space-available-card">
      <h2 className="title">
        Usado: <span>0%</span>
      </h2>
      <h3>
        <span>0GB</span> de 0GB
      </h3>
      <div className="progress-bar-container">
        <div className="progress-bar"></div>
      </div>
    </div>
  );
}

export default SpaceAvailableCard;
