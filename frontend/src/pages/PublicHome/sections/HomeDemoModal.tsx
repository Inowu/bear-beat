import { Modal } from "src/components/ui";
import { CheckCircle2 } from "src/icons";
import { Link } from "react-router-dom";
import CatalogPreviewWebp from "../../../assets/images/home-catalog-preview.webp";
import CatalogPreviewPng from "../../../assets/images/home-catalog-preview.png";
import { Button } from "src/components/ui";
export default function HomeDemoModal(props: {
  show: boolean;
  onHide: () => void;
  ctaLabel: string;
  primaryCheckoutFrom: string;
  onModalCtaClick: () => void;
}) {
  const { show, onHide, ctaLabel, primaryCheckoutFrom, onModalCtaClick } = props;

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      className="home-demo-modal"
      aria-labelledby="home-demo-title"
    >
      <Modal.Header closeButton closeLabel="Cerrar modal">
        <Modal.Title id="home-demo-title">Así se ve por dentro</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="home-demo-modal__sub">
          Vista real del catálogo. Al activar, ves tu biblioteca por secciones y descargas por FTP o web.
        </p>

        <div className="home-demo-modal__frame">
          <picture>
            <source srcSet={CatalogPreviewWebp} type="image/webp" />
            <img
              src={CatalogPreviewPng}
              alt="Vista real del catálogo por dentro (biblioteca y secciones)"
              width={960}
              height={600}
              loading="lazy"
              decoding="async"
            />
          </picture>
        </div>

        <ul className="home-demo-modal__bullets" aria-label="Qué verás al activar">
          <li className="bb-market-surface">
            <CheckCircle2 size={16} aria-hidden /> Secciones: Audios / Videos / Karaoke
          </li>
          <li className="bb-market-surface">
            <CheckCircle2 size={16} aria-hidden /> Búsqueda por canción, artista o carpeta
          </li>
          <li className="bb-market-surface">
            <CheckCircle2 size={16} aria-hidden /> Descargas por FTP (FileZilla/Air Explorer) o por web
          </li>
        </ul>

        <div className="home-demo-modal__actions">
          <Link
            to="/auth/prueba"
            state={{ from: primaryCheckoutFrom }}
            className="home-cta home-cta--primary home-demo-modal__cta"
            onClick={() => {
              onModalCtaClick();
              onHide();
            }}
          >
            {ctaLabel}
          </Link>
          <Link to="/instrucciones" className="home-link" onClick={onHide}>
            Ver instrucciones de descarga →
          </Link>
        </div>
      </Modal.Body>
    </Modal>
  );
}
