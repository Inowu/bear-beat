import { Modal } from "react-bootstrap";
import "../Modal.scss";
import "./ErrorModal.scss";
import { AlertTriangle, X } from "src/icons";
import { IUser } from "../../../interfaces/User";
import { toErrorMessage } from "../../../utils/errorMessage";

export type ErrorModalAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
};

interface IError {
  show: boolean;
  onHide: () => void;
  user?: IUser | null;
  message?: unknown;
  title?: string;
  hint?: string;
  actions?: ErrorModalAction[];
}
export function ErrorModal(props: IError) {
  const { show, onHide, message, title, hint, actions } = props;
  const raw = toErrorMessage(message).trim();
  const friendly =
    raw ||
    "Ocurrió un error al procesar tu solicitud. Intenta de nuevo en unos segundos.";
  const resolvedTitle = `${title ?? ""}`.trim() || "No se pudo completar";
  const resolvedHint = `${hint ?? ""}`.trim();
  const resolvedActions: ErrorModalAction[] =
    Array.isArray(actions) && actions.length > 0
      ? actions
      : [
          {
            label: "Cerrar",
            onClick: onHide,
            variant: "primary",
          },
        ];
  return (
    <Modal show={show} onHide={onHide} centered className="container-error-modal">
      <div className="modal-container error-modal">
        <div className="header">
          <div className="error-modal__title-wrap">
            <span className="error-modal__icon" aria-hidden>
              <AlertTriangle />
            </span>
            <p className="title">{resolvedTitle}</p>
          </div>
          <button type="button" className="error-modal__close" onClick={onHide} aria-label="Cerrar">
            <X aria-hidden />
          </button>
        </div>
        <div className="bottom">
          <p className="content">{friendly}</p>
          {resolvedHint && <p className="error-modal__hint">{resolvedHint}</p>}
          <div className="button-container-2">
            {resolvedActions.map((action, idx) => {
              const cls = action.variant === "secondary" ? "btn-option-5" : "btn-success";
              return (
                <button
                  key={`${action.label}-${idx}`}
                  type="button"
                  className={cls}
                  onClick={() => action.onClick()}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
