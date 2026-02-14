import React, { useCallback, useState } from "react";
import { Modal } from "react-bootstrap";
import { Check, Copy, Store, X } from "src/icons";
import { IOxxoData } from "interfaces/Plans";
import "../Modal.scss";
import "./OxxoModal.scss";
interface IOxxo {
    show: boolean;
    onHide: () => void;
    oxxoData: IOxxoData;
    price: string;
}
function formatExpires(expires: number): string {
  const date = new Date(expires * 1000);
  return date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

export function OxxoModal(props: IOxxo) {
  const { show, onHide, oxxoData, price } = props;
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  const amountValue = Number(price);
  const amountText = Number.isFinite(amountValue)
    ? `$${amountValue.toFixed(2)}`
    : `$${String(price ?? "").trim()}`;
  const reference = String(oxxoData?.reference ?? "").trim();
  const hasReference = reference.length >= 6;

  const barcodeUrl = String(oxxoData?.barcode_url ?? "").trim();
  const hostedVoucherUrl = String((oxxoData as any)?.hosted_voucher_url ?? "").trim();
  const barcodeLooksLikeImage =
    !!barcodeUrl &&
    (barcodeUrl.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|svg)(\\?|$)/i.test(barcodeUrl));
  const voucherUrl = hostedVoucherUrl || (!barcodeLooksLikeImage ? barcodeUrl : "");

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
    <Modal show={show} onHide={onHide} centered className="oxxo-modal-wrapper">
      <div className="modal-container oxxo-modal">
        <div className="header">
          <div className="oxxo-modal__title-wrap">
            <span className="oxxo-modal__icon" aria-hidden>
              <Store />
            </span>
            <div className="oxxo-modal__title-copy">
              <p className="title">Pago en efectivo</p>
              <p className="oxxo-modal__subtitle">
                Paga con tu referencia en tienda. Puede tardar hasta <strong>48 hrs</strong> en reflejarse.
              </p>
            </div>
          </div>
          <button type="button" className="oxxo-modal__close" onClick={onHide} aria-label="Cerrar">
            <X aria-hidden />
          </button>
        </div>

        <div className="bottom">
          <div className="oxxo-modal__grid">
            <div className="oxxo-modal__field">
              <span className="oxxo-modal__label">Referencia</span>
              {hasReference ? (
                <div className="oxxo-modal__value-row">
                  <code className="oxxo-modal__code">{reference}</code>
                  <button
                    type="button"
                    className="oxxo-modal__copy"
                    onClick={() => copyToClipboard(reference, setCopiedRef)}
                    title="Copiar referencia"
                  >
                    {copiedRef ? <Check aria-hidden /> : <Copy aria-hidden />}
                    <span>{copiedRef ? "Copiado" : "Copiar"}</span>
                  </button>
                </div>
              ) : (
                <p className="oxxo-modal__warning">
                  No se recibió la referencia. Cierra este mensaje e intenta de nuevo con «Efectivo» o elige tarjeta/SPEI.
                </p>
              )}

              {barcodeLooksLikeImage && (
                <div className="oxxo-modal__barcode">
                  <img src={barcodeUrl} alt="Código de barras para pago en efectivo" />
                </div>
              )}
              {!!voucherUrl && (
                <div className="oxxo-modal__voucher">
                  <a
                    className="oxxo-modal__voucher-link"
                    href={voucherUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir comprobante con código de barras
                  </a>
                  <p className="oxxo-modal__voucher-hint">
                    Se abre en otra pestaña. Puedes descargarlo o mostrarlo en caja para pagar.
                  </p>
                </div>
              )}

              <p className="oxxo-modal__expires">
                Válido antes del:{" "}
                <strong>{oxxoData?.expires_at ? formatExpires(oxxoData.expires_at) : "—"}</strong>
              </p>
            </div>

            <div className="oxxo-modal__field">
              <span className="oxxo-modal__label">Monto a pagar</span>
              <div className="oxxo-modal__value-row">
                <span className="oxxo-modal__amount">{amountText} MXN</span>
                <button
                  type="button"
                  className="oxxo-modal__copy"
                  onClick={() => copyToClipboard(amountText, setCopiedAmount)}
                  title="Copiar monto"
                >
                  {copiedAmount ? <Check aria-hidden /> : <Copy aria-hidden />}
                  <span>{copiedAmount ? "Copiado" : "Copiar"}</span>
                </button>
              </div>
              <p className="oxxo-modal__warning">
                Paga la cantidad <strong>exacta</strong> para que se asigne correctamente.
              </p>
              <p className="oxxo-modal__hint">
                Si ya pagaste y no se activó en 48 hrs, vuelve a revisar tu estado de pago desde tu cuenta.
              </p>
            </div>
          </div>

          <div className="button-container-2">
            <button type="button" className="btn-success" onClick={onHide}>
              Listo, ya pagué
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
