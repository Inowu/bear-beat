import { Modal } from "react-bootstrap";
import "../Modal.scss";
import "./ErrorModal.scss";
import { AlertTriangle, X } from "src/icons";
import { IUser } from "../../../interfaces/User";
import { toErrorMessage } from "../../../utils/errorMessage";
interface IError {
  show: boolean;
  onHide: () => void;
  user?: IUser | null;
  message?: unknown;
}
export function ErrorModal(props: IError) {
  const { show, onHide, message } = props;
  const raw = toErrorMessage(message).trim();
  const friendly =
    raw ||
    "Ocurrió un error al procesar tu solicitud. Intenta de nuevo en unos segundos.";
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
          <div className="button-container-2">
            <button type="button" className="btn-success" onClick={onHide}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
