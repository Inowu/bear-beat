import { Modal } from "react-bootstrap";
import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import CatalogPreviewImg from "../../../assets/images/home-catalog-preview.webp";

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
          Vista real del catálogo. Al activar, ves tu biblioteca por secciones y descargas por FTP o web.
        </p>

        <div className="home-demo-modal__frame">
          <img
            src={CatalogPreviewImg}
            alt="Vista real del catálogo por dentro (biblioteca y secciones)"
            width={960}
            height={600}
            loading="lazy"
            decoding="async"
          />
        </div>

        <ul className="home-demo-modal__bullets" aria-label="Qué verás al activar">
          <li>
            <CheckCircle2 size={16} aria-hidden /> Secciones: Audios / Videos / Karaoke
          </li>
          <li>
            <CheckCircle2 size={16} aria-hidden /> Búsqueda por canción, artista o carpeta
          </li>
          <li>
            <CheckCircle2 size={16} aria-hidden /> Descargas por FTP (FileZilla/Air Explorer) o por web
          </li>
        </ul>

        <div className="home-demo-modal__links">
          <Link to="/instrucciones" className="home-link" onClick={onHide}>
            Ver instrucciones de descarga →
          </Link>
        </div>
      </Modal.Body>
    </Modal>
  );
}
