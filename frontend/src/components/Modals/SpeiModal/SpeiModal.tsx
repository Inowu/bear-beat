import React, { useState, useCallback } from "react";
import { Modal } from "react-bootstrap";
import { PiCopy, PiCheck, PiShieldCheck } from "react-icons/pi";
import { RiCloseLine } from "react-icons/ri";
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
            <RiCloseLine aria-hidden />
          </button>
        </div>

        <div className="spei-terminal__body">
          {/* CLABE — El héroe */}
          <div className="spei-terminal__block">
            <label className="spei-terminal__label">CLABE interbancaria</label>
            <div className="spei-terminal__clabe-row">
              <code className="spei-terminal__clabe">{speiData.clabe}</code>
              <button
                type="button"
                className="spei-terminal__copy-btn"
                onClick={() => copyToClipboard(speiData.clabe, setCopiedClabe)}
                title="Copiar CLABE"
              >
                {copiedClabe ? <PiCheck aria-hidden /> : <PiCopy aria-hidden />}
                <span>{copiedClabe ? "Copiado" : "Copiar"}</span>
              </button>
            </div>
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
                {copiedAmount ? <PiCheck aria-hidden /> : <PiCopy aria-hidden />}
                <span>{copiedAmount ? "Copiado" : "Copiar"}</span>
              </button>
            </div>
            <p className="spei-terminal__warning">
              ⚠️ Transfiere la cantidad EXACTA, ni un peso más ni menos.
            </p>
          </div>

          {/* Instrucciones paso a paso */}
          <ol className="spei-terminal__steps">
            <li>Copia la CLABE única.</li>
            <li>Ve a tu app bancaria y da de alta la cuenta.</li>
            <li>Realiza la transferencia.</li>
            <li>¡Listo! Tu acceso se activará en automático.</li>
          </ol>

          <p className="spei-terminal__expires">
            Válido antes del: <strong>{formatExpires(speiData.expires_at)}</strong>
          </p>

          <p className="spei-terminal__trust">
            <PiShieldCheck aria-hidden /> Transacción encriptada y segura
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
