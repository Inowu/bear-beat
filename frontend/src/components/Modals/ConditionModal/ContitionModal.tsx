import React from 'react'
import { Modal } from 'react-bootstrap'
import './../Modal.scss'
import {RiCloseCircleLine} from 'react-icons/ri'
interface ICondition {
    show: boolean;
    onHide: () => void;
    action: () => void;
    title: string;
    message?: string;
}
export function ConditionModal (props: ICondition)  {
    const {show, onHide, message, action, title} = props;
  return (
    <Modal show={show} onHide={onHide} centered>
        <div className='modal-container error-modal'>
            <div className='header'>
                <p className='title'>{title}</p>
                <RiCloseCircleLine className='icon' onClick={onHide}/>
            </div>
            <div className='bottom'>
                <p className='content'>
                    {message?.toString()}
                </p>
                <div className='button-container'>
                  <button className='btn-cancel' onClick={onHide}>
                    Cancelar
                  </button>
                  <button className='btn-retry' onClick={action}>
                    Confirmar
                  </button>
                </div>
            </div>
        </div>
    </Modal>
  )
}