import React, { useState, useCallback } from "react";
import { Modal } from "react-bootstrap";
import { Check, Copy, ShieldCheck, X } from "lucide-react";
import { ISpeiData } from "../../../interfaces/Plans";
import "../Modal.scss";
import "./SpeiModal.scss";

interface ISpei {
  show: boolean;
  onHide: () => void;
  speiData: ISpeiData;
  price: string;
}

function formatExpires(expires: number): string {
  const date = new Date(expires * 1000);
  return date.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function SpeiModal(props: ISpei) {
  const { show, onHide, speiData, price } = props;
  const [copiedClabe, setCopiedClabe] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  const amountText = `$${price}.00`;
  // Conekta puede devolver la CLABE en "clabe" o en "receiving_account_number"
  const clabe = speiData.clabe ?? speiData.receiving_account_number ?? "";
  const bankName = speiData.receiving_account_bank || "STP";
  const holderName = speiData.receiving_account_holder_name || "CONEKTA";
  const bankLabel =
    bankName === "STP"
      ? "STP (Sistema de Transferencias y Pagos)"
      : bankName;
  const hasClabe = clabe.length >= 18;

  const copyToClipboard = useCallback((text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setter(true);
        setTimeout(() => setter(false), 2000);
      },
      () => {}
    );
  }, []);

  return (
    <Modal show={show} onHide={onHide} centered className="spei-modal-wrapper">
      <div className="modal-container spei-terminal">
        <div className="spei-terminal__header">
          <h2 className="spei-terminal__title">Transferencia Bancaria (SPEI)</h2>
          <button type="button" className="spei-terminal__close" onClick={onHide} aria-label="Cerrar">
            <X aria-hidden />
          </button>
        </div>

        <div className="spei-terminal__body">
          {/* A nombre de quién / Banco — evita confusión en la app bancaria */}
          <div className="spei-terminal__block spei-terminal__block--highlight">
            <label className="spei-terminal__label">Banco receptor</label>
            <p className="spei-terminal__value">{bankLabel}</p>
            <p className="spei-terminal__hint">Usa esta CLABE en cualquier banco (BBVA, Santander, etc.).</p>
          </div>
          <div className="spei-terminal__block spei-terminal__block--highlight">
            <label className="spei-terminal__label">Nombre del beneficiario (a quién hacer la transferencia)</label>
            <p className="spei-terminal__value spei-terminal__value--holder">{holderName}</p>
            <p className="spei-terminal__hint">En tu app bancaria, cuando des de alta la cuenta, usa este nombre como titular.</p>
          </div>

          {/* CLABE interbancaria */}
          <div className="spei-terminal__block">
            <label className="spei-terminal__label">CLABE interbancaria (18 dígitos)</label>
            {hasClabe ? (
              <div className="spei-terminal__clabe-row">
                <code className="spei-terminal__clabe">{clabe}</code>
                <button
                  type="button"
                  className="spei-terminal__copy-btn"
                  onClick={() => copyToClipboard(clabe, setCopiedClabe)}
                  title="Copiar CLABE"
                >
                  {copiedClabe ? <Check aria-hidden /> : <Copy aria-hidden />}
                  <span>{copiedClabe ? "Copiado" : "Copiar"}</span>
                </button>
              </div>
            ) : (
              <p className="spei-terminal__warning">
                No se recibió la CLABE. Cierra este mensaje e intenta de nuevo con «SPEI», o elige otro método de pago.
              </p>
            )}
          </div>

          {/* Monto + advertencia */}
          <div className="spei-terminal__block">
            <label className="spei-terminal__label">Monto a transferir</label>
            <div className="spei-terminal__amount-row">
              <span className="spei-terminal__amount">{amountText} MXN</span>
              <button
                type="button"
                className="spei-terminal__copy-btn"
                onClick={() => copyToClipboard(amountText, setCopiedAmount)}
                title="Copiar monto"
              >
                {copiedAmount ? <Check aria-hidden /> : <Copy aria-hidden />}
                <span>{copiedAmount ? "Copiado" : "Copiar"}</span>
              </button>
            </div>
            <p className="spei-terminal__warning">
              ⚠️ Transfiere la cantidad EXACTA, ni un peso más ni menos.
            </p>
          </div>

          {/* Instrucciones paso a paso */}
          <ol className="spei-terminal__steps">
            <li>Anota el <strong>banco</strong> ({bankLabel}) y el <strong>beneficiario</strong> ({holderName}).</li>
            <li>Copia la CLABE y en tu app bancaria da de alta la cuenta (banco {bankLabel}, titular {holderName}).</li>
            <li>Transfiere el monto exacto: <strong>{amountText} MXN</strong>.</li>
            <li>Tu acceso se activará en automático al detectar el pago.</li>
          </ol>

          <p className="spei-terminal__expires">
            Válido antes del: <strong>{speiData.expires_at ? formatExpires(speiData.expires_at) : "—"}</strong>
          </p>

          <p className="spei-terminal__trust">
            <ShieldCheck aria-hidden /> Transacción encriptada y segura
          </p>

          <div className="spei-terminal__actions">
            <button type="button" className="spei-terminal__btn-primary" onClick={onHide}>
              Ya realicé el pago
            </button>
            <button type="button" className="spei-terminal__btn-secondary" onClick={onHide}>
              Cancelar / Cerrar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
