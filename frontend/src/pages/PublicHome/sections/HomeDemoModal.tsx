import { Modal } from "react-bootstrap";
import { FolderOpen, PlayCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function HomeDemoModal(props: {
  show: boolean;
  onHide: () => void;
}) {
  const { show, onHide } = props;

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      className="home-demo-modal"
      aria-labelledby="home-demo-title"
    >
      <Modal.Header closeButton>
        <Modal.Title id="home-demo-title">Así se ve por dentro</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="home-demo-modal__sub">
          {/* TODO: reemplazar este placeholder por video (20–30s) o screenshot real del catálogo. */}
          Demo visual del orden por carpetas (género → año → mes). Al activar, ves el catálogo completo.
        </p>

        <div className="home-demo-modal__frame" role="img" aria-label="Estructura de carpetas del catálogo">
          <div className="home-demo-modal__row">
            <FolderOpen size={18} aria-hidden />
            <strong>Video Remixes</strong>
          </div>
          <div className="home-demo-modal__row home-demo-modal__row--muted">
            <PlayCircle size={18} aria-hidden />
            <span>Género</span>
          </div>
          <div className="home-demo-modal__row home-demo-modal__row--muted">
            <PlayCircle size={18} aria-hidden />
            <span>Año</span>
          </div>
          <div className="home-demo-modal__row home-demo-modal__row--muted">
            <PlayCircle size={18} aria-hidden />
            <span>Mes</span>
          </div>
        </div>

        <div className="home-demo-modal__links">
          <Link to="/instrucciones" className="home-link" onClick={onHide}>
            Ver instrucciones de descarga →
          </Link>
        </div>
      </Modal.Body>
    </Modal>
  );
}

