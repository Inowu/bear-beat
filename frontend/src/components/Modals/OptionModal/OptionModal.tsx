import './../Modal.scss'
import './OptionModal.scss'
import { ErrorModal } from '../ErrorModal/ErrorModal'
import { SuccessModal } from '../SuccessModal/SuccessModal'
import { IPlans } from 'interfaces/Plans';
import { Modal } from 'react-bootstrap'
import { XCircle } from "src/icons"
import { useEffect, useState } from 'react'
import trpc from "../../../api";
interface IError {
  show: boolean;
  onHide: () => void;
  userId: number;
  title: string;
  message?: string;
  plans: IPlans[]
}
export function OptionModal(props: IError) {
  const { show, onHide, message, userId, plans, title } = props;
  const [showError, setShowError] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("Plan activado con éxito.");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [provider, setProvider] = useState<"stripe" | "stripe_oxxo" | "paypal" | "conekta">("stripe");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [createOrderIfMissing, setCreateOrderIfMissing] = useState<boolean>(false);
  const [activatingByPayment, setActivatingByPayment] = useState<boolean>(false);

  const closeErrorModal = () => {
    setShowError(false);
  };

  const closeOptionModal = () => {
    onHide();
  };

  const activateSubscription = async (planId: number) => {
    try {
      let body = {
        planId,
        userId: userId,
      };
      await trpc.admin.activatePlanForUser.mutate(body);
      closeOptionModal();
      setSuccessMessage("Plan activado con éxito.");
      setShowSuccess(true);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.warn("[ADMIN][OPTION_MODAL] Failed to activate subscription.");
      }
      setErrorMessage(error.message)
      setShowError(true);
    }

  };

  const activateByPaymentReference = async () => {
    if (!selectedPlanId) {
      setErrorMessage("Selecciona un plan para activar.");
      setShowError(true);
      return;
    }
    const trimmedReference = paymentReference.trim();
    if (!trimmedReference) {
      setErrorMessage("Ingresa una referencia de pago.");
      setShowError(true);
      return;
    }

    setActivatingByPayment(true);
    try {
      const response = await trpc.admin.activatePlanFromPaymentReference.mutate({
        userId,
        planId: selectedPlanId,
        provider,
        paymentReference: trimmedReference,
        createOrderIfMissing,
      });
      closeOptionModal();
      const sourceLabel =
        response?.source === "created_manual_order"
          ? "orden creada manualmente"
          : "orden existente";
      setSuccessMessage(
        `Plan activado con éxito (orden #${response?.orderId ?? "N/A"}, ${sourceLabel}).`,
      );
      setShowSuccess(true);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.warn("[ADMIN][OPTION_MODAL] Failed to activate subscription by payment reference.");
      }
      setErrorMessage(error?.message || "No se pudo activar el plan con esa referencia de pago.");
      setShowError(true);
    } finally {
      setActivatingByPayment(false);
    }
  };

  useEffect(() => {
    if (!show) return;
    const defaultPlanId = plans?.[0]?.id ?? null;
    setSelectedPlanId((prev) =>
      prev && plans.some((plan) => plan.id === prev) ? prev : defaultPlanId,
    );
    setPaymentReference("");
    setProvider("stripe");
    setCreateOrderIfMissing(false);
  }, [show, plans]);

  return (
    <>
      <Modal show={show} onHide={closeOptionModal} centered>
        <div className='modal-container option-modal'>
          <div className='header'>
            <p className='title'>{title}</p>
            <XCircle className='icon' onClick={closeOptionModal} aria-label="Cerrar" />
          </div>
          <div className='bottom'>
            <p className='content'>
              {message?.toString()}
            </p>
            <div className='plan-options-container'>
              {plans.map((plan) => {
                return <button key={`plan-button-${plan.id}`} className='plan-option-button' onClick={() => activateSubscription(plan.id)}>
                  {plan.name} - ${plan.price} {plan.moneda.toUpperCase()} - {plan.paypal_plan_id ? "PayPal" : "Stripe"}
                </button>
              })}
            </div>
            <div className="payment-reconcile-container">
              <p className="payment-reconcile-title">Activar por pago validado</p>
              <label htmlFor="option-modal-plan">Plan</label>
              <select
                id="option-modal-plan"
                value={selectedPlanId ?? ""}
                onChange={(e) => setSelectedPlanId(Number(e.target.value))}
              >
                {plans.map((plan) => (
                  <option key={`plan-select-${plan.id}`} value={plan.id}>
                    {plan.name} - ${plan.price} {plan.moneda.toUpperCase()}
                  </option>
                ))}
              </select>

              <label htmlFor="option-modal-provider">Proveedor</label>
              <select
                id="option-modal-provider"
                value={provider}
                onChange={(e) =>
                  setProvider(
                    e.target.value as "stripe" | "stripe_oxxo" | "paypal" | "conekta",
                  )
                }
              >
                <option value="stripe">Stripe</option>
                <option value="stripe_oxxo">Stripe OXXO</option>
                <option value="paypal">PayPal</option>
                <option value="conekta">Conekta</option>
              </select>

              <label htmlFor="option-modal-payment-reference">Referencia de pago</label>
              <input
                id="option-modal-payment-reference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Ej: pi_..., sub_..., I-..., ord_..."
              />

              <label className="payment-reconcile-checkbox">
                <input
                  type="checkbox"
                  checked={createOrderIfMissing}
                  onChange={(e) => setCreateOrderIfMissing(e.target.checked)}
                />
                Crear orden manual si no existe en BD
              </label>

              <button
                type="button"
                className="plan-option-button payment-reconcile-button"
                onClick={activateByPaymentReference}
                disabled={activatingByPayment}
              >
                {activatingByPayment ? "Activando..." : "Activar con referencia"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
      <ErrorModal show={showError} onHide={closeErrorModal} message={errorMessage} />
      <SuccessModal
        show={showSuccess}
        onHide={() => setShowSuccess(false)}
        title="Plan activado"
        message={successMessage}
      />
    </>
  )
}
