import { Modal } from "react-bootstrap";
import "../Modal.scss";
import "./ErrorModal.scss";
import { AlertTriangle, X } from "lucide-react";
import { IUser } from "../../../interfaces/User";
import { openSupportChat } from "../../../utils/supportChat";
interface IError {
  show: boolean;
  onHide: () => void;
  user?: IUser | null;
  message?: string;
}
export function ErrorModal(props: IError) {
  const { show, onHide, message } = props;
  const raw = (message ?? "").toString().trim();
  const friendly =
    raw ||
    "Ocurrió un error al procesar tu solicitud. Intenta de nuevo o abre soporte por chat.";
  return (
    <Modal show={show} onHide={onHide} centered className="container-error-modal">
      <div className="modal-container error-modal">
        <div className="header">
          <div className="error-modal__title-wrap">
            <span className="error-modal__icon" aria-hidden>
              <AlertTriangle />
            </span>
            <p className="title">No se pudo completar</p>
          </div>
          <button type="button" className="error-modal__close" onClick={onHide} aria-label="Cerrar">
            <X aria-hidden />
          </button>
        </div>
        <div className="bottom">
          <p className="content">{friendly}</p>
          <p className="error-modal__hint">
            Si esto te está bloqueando, te ayudamos por chat en tiempo real.
          </p>
          <div className="button-container-2">
            <button
              type="button"
              className="btn-option-5"
              onClick={() => openSupportChat("error_modal")}
            >
              Abrir soporte
            </button>
            <button type="button" className="btn-success" onClick={onHide}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
