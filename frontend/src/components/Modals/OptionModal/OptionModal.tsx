import './../Modal.scss'
import './OptionModal.scss'
import { ErrorModal } from '../ErrorModal/ErrorModal'
import { SuccessModal } from '../SuccessModal/SuccessModal'
import { IPlans } from 'interfaces/Plans';
import { Modal } from 'react-bootstrap'
import { XCircle } from "src/icons"
import { useState } from 'react'
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

  const closeErrorModal = () => {
    setShowError(false);
  };

  const activateSubscription = async (planId: number) => {
    try {
      let body = {
        planId,
        userId: userId,
      };
      await trpc.admin.activatePlanForUser.mutate(body);
      onHide();
      setShowSuccess(true);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.warn("[ADMIN][OPTION_MODAL] Failed to activate subscription.");
      }
      setErrorMessage(error.message)
      setShowError(true);
    }

  };

  return (
    <>
      <Modal show={show} onHide={onHide} centered>
        <div className='modal-container option-modal'>
          <div className='header'>
            <p className='title'>{title}</p>
            <XCircle className='icon' onClick={onHide} aria-label="Cerrar" />
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
          </div>
        </div>
      </Modal>
      <ErrorModal show={showError} onHide={closeErrorModal} message={errorMessage} />
      <SuccessModal
        show={showSuccess}
        onHide={() => setShowSuccess(false)}
        title="Plan activado"
        message="Plan activado con éxito."
      />
    </>
  )
}
