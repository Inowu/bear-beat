import React from 'react'
import { Modal } from 'react-bootstrap'
import './../Modal.scss'
import {RiCloseCircleLine} from 'react-icons/ri'
interface IError {
    show: boolean;
    onHide: () => void;
    action: () => void;
    action2: () => void;
    title: string;
    message?: string;
}
export function OptionModal (props: IError)  {
    const {show, onHide, message, action, action2, title} = props;
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
                  <button className='btn-option-1' onClick={action}>
                    Plan 1: 
                  </button>
                  <button className='btn-option-2' onClick={action2}>
                    Plan 2:
                  </button>
                </div>
            </div>
        </div>
    </Modal>
  )
}