import React, { useEffect, useMemo, useState } from "react";
import { Button, Modal, Select } from "src/components/ui";
import "./CancellationReasonModal.scss";

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
    title = "Cancelación de suscripción",
    message = "Antes de cancelar, cuéntanos el motivo. Nos ayuda a mejorar tu experiencia.",
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
  const remainingChars = Math.max(0, maxTextLength - reasonText.length);
  const textUsagePercent = Math.min(100, Math.round((reasonText.length / maxTextLength) * 100));

  useEffect(() => {
    if (!show) return;
    setReasonCode("");
    setReasonText("");
    setLoader(false);
    setErrorMessage("");
  }, [show]);

  const startConfirm = async () => {
    if (loader) return;
    if (!reasonCode) {
      setErrorMessage("Selecciona un motivo para continuar.");
      return;
    }
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
    <Modal show={show} onHide={onHide} centered size="md" className="cancellation-reason-modal">
      <Modal.Header closeButton closeLabel="Cerrar modal">
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="cancel-reason__lead">{message}</p>

        <div className="cancel-reason__field">
          <label htmlFor="cancel-reason-code" className="cancel-reason__label">
            Motivo <span>(requerido)</span>
          </label>
          <Select
            id="cancel-reason-code"
            className="cancel-reason__select"
            value={reasonCode}
            hasError={Boolean(errorMessage && !reasonCode)}
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
          </Select>
          {selectedReason?.helper && (
            <p className="cancel-reason__helper" role="status">
              {selectedReason.helper}
            </p>
          )}
        </div>

        <div className="cancel-reason__field">
          <label htmlFor="cancel-reason-detail" className="cancel-reason__label">
            Detalle <span>(opcional)</span>
          </label>
          <textarea
            id="cancel-reason-detail"
            className="cancel-reason__textarea"
            value={reasonText}
            maxLength={maxTextLength}
            onChange={(event) => {
              setReasonText(event.target.value);
              setErrorMessage("");
            }}
            placeholder="Opcional. No incluyas datos personales."
            rows={4}
          />
          <div className="cancel-reason__counter">
            <span>{remainingChars} caracteres restantes</span>
            <span>{textUsagePercent}%</span>
          </div>
          <span className="cancel-reason__counter-bar" aria-hidden>
            <span
              className="cancel-reason__counter-fill"
              style={{ width: `${textUsagePercent}%` }}
            />
          </span>
        </div>

        {errorMessage && (
          <p role="alert" className="cancel-reason__error">
            {errorMessage}
          </p>
        )}
      </Modal.Body>

      <Modal.Footer>
        <div className="cancel-reason__actions">
          <Button
            variant="secondary"
            className="cancel-reason__back-btn"
            onClick={onHide}
            disabled={loader}
          >
            Volver
          </Button>
          <Button
            variant="danger"
            className="cancel-reason__confirm-btn"
            onClick={startConfirm}
            loading={loader}
            disabled={!reasonCode}
          >
            Confirmar cancelación
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
