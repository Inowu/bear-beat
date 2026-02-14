import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "react-bootstrap";
import { XCircle } from "src/icons";
import { Spinner } from "../../../components/Spinner/Spinner";
import "../Modal.scss";

export type CancellationReasonCode =
  | "too_expensive"
  | "not_using_enough"
  | "missing_content"
  | "technical_issues"
  | "found_alternative"
  | "temporary_pause"
  | "other";

const DEFAULT_REASONS: Array<{ code: CancellationReasonCode; label: string; helper?: string }> = [
  { code: "too_expensive", label: "Es muy caro" },
  { code: "not_using_enough", label: "No lo estoy usando suficiente" },
  { code: "missing_content", label: "No encontré lo que buscaba" },
  { code: "technical_issues", label: "Tuve problemas técnicos / algo se rompió" },
  { code: "found_alternative", label: "Encontré otra alternativa" },
  { code: "temporary_pause", label: "Solo es una pausa temporal" },
  { code: "other", label: "Otro" },
];

interface CancellationReasonModalProps {
  show: boolean;
  onHide: () => void;
  title?: string;
  message?: string;
  reasons?: Array<{ code: CancellationReasonCode; label: string; helper?: string }>;
  onConfirm: (payload: { reasonCode: CancellationReasonCode; reasonText: string }) => Promise<void>;
  onReasonChange?: (reasonCode: CancellationReasonCode) => void;
  maxTextLength?: number;
}

export function CancellationReasonModal(props: CancellationReasonModalProps) {
  const {
    show,
    onHide,
    onConfirm,
    onReasonChange,
    title = "Cancelar suscripción",
    message = "Ayúdanos a mejorar. Selecciona el motivo de tu cancelación.",
    reasons = DEFAULT_REASONS,
    maxTextLength = 500,
  } = props;

  const [reasonCode, setReasonCode] = useState<CancellationReasonCode | "">("");
  const [reasonText, setReasonText] = useState<string>("");
  const [loader, setLoader] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const selectedReason = useMemo(
    () => reasons.find((item) => item.code === reasonCode) ?? null,
    [reasonCode, reasons],
  );

  useEffect(() => {
    if (!show) return;
    setReasonCode("");
    setReasonText("");
    setLoader(false);
    setErrorMessage("");
  }, [show]);

  const startConfirm = async () => {
    if (!reasonCode || loader) return;
    setLoader(true);
    setErrorMessage("");
    try {
      await onConfirm({
        reasonCode,
        reasonText: reasonText.trim().slice(0, maxTextLength),
      });
      setLoader(false);
      onHide();
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : "No se pudo cancelar tu suscripción. Intenta de nuevo.";
      setLoader(false);
      setErrorMessage(msg);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <div className="modal-container success-modal">
        <div className="header">
          <p className="title">{title}</p>
          <XCircle className="icon" onClick={onHide} aria-label="Cerrar" />
        </div>
        <div className="bottom">
          <p className="content">{message}</p>

          <div className="c-row" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Motivo (requerido)</span>
              <select
                className="form-select"
                value={reasonCode}
                onChange={(event) => {
                  const next = event.target.value as CancellationReasonCode | "";
                  setReasonCode(next);
                  setErrorMessage("");
                  if (next) onReasonChange?.(next);
                }}
              >
                <option value="" disabled>
                  Selecciona una opción...
                </option>
                {reasons.map((reason) => (
                  <option key={reason.code} value={reason.code}>
                    {reason.label}
                  </option>
                ))}
              </select>
              {selectedReason?.helper && (
                <small className="text-muted">{selectedReason.helper}</small>
              )}
            </label>
          </div>

          <div className="c-row" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Detalle (opcional)</span>
              <textarea
                className="form-control"
                value={reasonText}
                maxLength={maxTextLength}
                onChange={(event) => {
                  setReasonText(event.target.value);
                  setErrorMessage("");
                }}
                placeholder="Opcional. No incluyas datos personales."
                rows={3}
              />
              <small className="text-muted">
                {Math.max(0, maxTextLength - reasonText.length)} caracteres restantes
              </small>
            </label>
          </div>

          {errorMessage && (
            <p
              role="alert"
              style={{
                color: "var(--app-status-error)",
                background: "color-mix(in srgb, var(--app-status-error) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--app-status-error) 25%, transparent)",
                padding: 12,
                borderRadius: 12,
              }}
            >
              {errorMessage}
            </p>
          )}

          <div className="button-container">
            <button className="btn-option-5" onClick={onHide} disabled={loader}>
              Volver
            </button>
            {!loader ? (
              <button
                className="btn-option-4"
                onClick={startConfirm}
                disabled={!reasonCode}
              >
                Confirmar cancelación
              </button>
            ) : (
              <div style={{ width: 189 }}>
                <Spinner size={3} width={0.3} color="var(--app-accent)" />
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
