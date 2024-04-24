import './../Modal.scss'
import './OptionModal.scss'
import { ErrorModal } from '../ErrorModal/ErrorModal'
import { IPlans } from 'interfaces/Plans';
import { Modal } from 'react-bootstrap'
import { RiCloseCircleLine } from 'react-icons/ri'
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
      alert("Plan activado con éxito!");
    } catch (error: any) {
      console.log(error);
      setErrorMessage(error.message)
      setShowError(true);
    }

  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <div className='modal-container option-modal'>
        <div className='header'>
          <p className='title'>{title}</p>
          <RiCloseCircleLine className='icon' onClick={onHide} />
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
      <ErrorModal show={showError} onHide={closeErrorModal} message={errorMessage} />
    </Modal>
  )
}