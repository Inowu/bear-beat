import React, { useState, useCallback } from "react";
import { Modal } from "src/components/ui";
import { Check, Copy, Landmark, ShieldCheck, X } from "src/icons";
import { ISpeiData } from "../../../interfaces/Plans";
import "../Modal.scss";
import "./SpeiModal.scss";
import { Button } from "src/components/ui";
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

  const amountValue = Number(price);
  const amountText = Number.isFinite(amountValue)
    ? `$${amountValue.toFixed(2)}`
    : `$${String(price ?? "").trim()}`;
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
      <div className="modal-container spei-modal">
        <div className="header">
          <div className="spei-modal__title-wrap">
            <span className="spei-modal__icon" aria-hidden>
              <Landmark />
            </span>
            <div className="spei-modal__title-copy">
              <p className="title">Pago por SPEI</p>
              <p className="spei-modal__subtitle">
                Transfiere el monto exacto y tu acceso se activará automáticamente.
              </p>
            </div>
          </div>
          <Button unstyled type="button" className="spei-modal__close" onClick={onHide} aria-label="Cerrar">
            <X aria-hidden />
          </Button>
        </div>

        <div className="bottom">
          <div className="spei-modal__grid">
            <div className="spei-modal__field">
              <span className="spei-modal__label">CLABE interbancaria</span>
              {hasClabe ? (
                <div className="spei-modal__value-row">
                  <code className="spei-modal__code">{clabe}</code>
                  <Button unstyled
                    type="button"
                    className="spei-modal__copy"
                    onClick={() => copyToClipboard(clabe, setCopiedClabe)}
                    title="Copiar CLABE"
                  >
                    {copiedClabe ? <Check aria-hidden /> : <Copy aria-hidden />}
                    <span>{copiedClabe ? "Copiado" : "Copiar"}</span>
                  </Button>
                </div>
              ) : (
                <p className="spei-modal__warning">
                  No se recibió la CLABE. Cierra este mensaje e intenta de nuevo con «SPEI» o elige tarjeta.
                </p>
              )}
              <p className="spei-modal__hint">
                Banco receptor: <strong>{bankLabel}</strong>
              </p>
              <p className="spei-modal__hint">
                Beneficiario: <strong>{holderName}</strong>
              </p>
            </div>

            <div className="spei-modal__field">
              <span className="spei-modal__label">Monto a transferir</span>
              <div className="spei-modal__value-row">
                <span className="spei-modal__amount">{amountText} MXN</span>
                <Button unstyled
                  type="button"
                  className="spei-modal__copy"
                  onClick={() => copyToClipboard(amountText, setCopiedAmount)}
                  title="Copiar monto"
                >
                  {copiedAmount ? <Check aria-hidden /> : <Copy aria-hidden />}
                  <span>{copiedAmount ? "Copiado" : "Copiar"}</span>
                </Button>
              </div>
              <p className="spei-modal__warning">
                Transfiere la cantidad <strong>exacta</strong>, ni un peso más ni un peso menos.
              </p>
              <p className="spei-modal__expires">
                Válido antes del:{" "}
                <strong>{speiData.expires_at ? formatExpires(speiData.expires_at) : "—"}</strong>
              </p>
              <p className="spei-modal__trust">
                <ShieldCheck aria-hidden /> Transacción segura
              </p>
            </div>
          </div>

          <div className="button-container-2">
            <Button unstyled type="button" className="btn-success" onClick={onHide}>
              Listo, ya pagué
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
