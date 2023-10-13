import { useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import videoSrc from "src/assets/video/DAKITI.mp4";
import trpc from "../../api";
import "./PreviewModal.scss";

interface PreviewModalPropsI {
  show: boolean;
  onHide: () => void;
}

function PreviewModal(props: PreviewModalPropsI) {
  const { show, onHide } = props;
  const [demoPath, setDemoPath] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const path = await trpc.ftp.demo.query({
        path: "04 Karaokes Abril 2023/Arcangel & Bad Bunny - La Jumpa.mp4",
        // path: "test.mp3",
      });

      setDemoPath(path.demo);
    })();
  }, []);

  if (!demoPath) {
    console.log("Loading demo...");

    return null;
  }

  console.log(demoPath);

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      aria-labelledby="contained-modal-title-vcenter"
      centered
      className="preview-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-vcenter">
          REPRODUCIENDO
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="preview-container">
          <video
            src={encodeURI(
              "https://thebearbeatapi.lat/demos/Ladies Night (ultimix Looking Back 12)kool & The Gang (dj Shaqwave.mp3",
            )}
            // src="http://localhost:5000/demos/test.mp3"
            controls
            autoPlay
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <p>
          Este demo es de 60 segundos y con resolución limitada. Una vez que
          realizas la descarga con tu plan este tendrá el tiempo completo y alta
          resolución.
        </p>
        <button className="btn primary-pill linear-bg" onClick={onHide}>
          Cerrar
        </button>
      </Modal.Footer>
    </Modal>
  );
}

export default PreviewModal;
