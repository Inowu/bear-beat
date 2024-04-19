import React from 'react'
import { Modal } from 'react-bootstrap'
import './../Modal.scss'
import './OptionModal.scss'
import { RiCloseCircleLine } from 'react-icons/ri'
import { IPlans } from 'interfaces/Plans';
interface IError {
  show: boolean;
  onHide: () => void;
  action: (planId: number) => void;
  title: string;
  message?: string;
  plans: IPlans[]
}
export function OptionModal(props: IError) {
  const { show, onHide, message, action, plans, title } = props;
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
              return <button key={`button-plan${plan.id}`} className='plan-option-button' onClick={() => action(plan.id)}>
                {plan.name} - ${plan.price} {plan.moneda.toUpperCase()} - {plan.paypal_plan_id ? "PayPal" : "Stripe"}
              </button>
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}