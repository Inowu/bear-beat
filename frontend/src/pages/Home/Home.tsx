import "./Home.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolder,
  faPlay,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";
import PreviewModal from "../../components/PreviewModal/PreviewModal";
import { useState } from "react";

function Home() {
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  return (
    <div className="home-main-container">
      <PreviewModal
        show={showPreviewModal}
        onHide={() => setShowPreviewModal(!showPreviewModal)}
      />
      <h2>
        <FontAwesomeIcon icon={faFolder} /> Todos los archivos
      </h2>
      <div className="folders-navigation-container">
        <div className="header">
          <div>Nombre</div>
          <div className="modified-column">Modificado</div>
        </div>
        <div className="folders-cards-container">
          <div className="folder-card">
            <div className="name-container">
              <FontAwesomeIcon icon={faFolder} />
              <h3>01 Audios Enero 2023</h3>
            </div>
            <div className="modified-column">
              <h4>
                {new Date().toLocaleString("en-US", {
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </h4>
            </div>
          </div>
          <div className="folder-card video-card">
            <FontAwesomeIcon
              icon={faPlay}
              onClick={() => setShowPreviewModal(true)}
            />
            <div className="name-container">
              <h3>Dog Night - Mama Told me not to c.mp3</h3>
            </div>
            <FontAwesomeIcon icon={faDownload} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
