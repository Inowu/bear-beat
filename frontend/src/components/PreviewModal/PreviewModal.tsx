import { useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import videoSrc from "src/assets/video/DAKITI.mp4";
import trpc from "../../api";
import "./PreviewModal.scss";
import { convertBase64ToMP3 } from "../../functions/functions";

interface PreviewModalPropsI {
  file: any;
  show: boolean;
  onHide: () => void;
}

function PreviewModal(props: PreviewModalPropsI) {
  const { show, onHide, file } = props;

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
          <video controls autoPlay={true}>
            <source src={file} />
          </video>
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
