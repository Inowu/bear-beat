import React from 'react'
import { Modal } from 'react-bootstrap'
import './../Modal.scss'
import {RiCloseCircleLine} from 'react-icons/ri'
interface IError {
    show: boolean;
    onHide: () => void;
    message?: string;
}
export function ErrorModal (props: IError)  {
    const {show, onHide, message} = props;
  return (
    <Modal show={show} onHide={onHide} centered>
        <div className='modal-container error-modal'>
            <div className='header'>
                <p className='title'>Error</p>
                <RiCloseCircleLine className='icon' onClick={onHide}/>
            </div>
            <div className='bottom'>
                <p className='content'>
                    {message?.toString()}
                </p>
                <div className='button-container'>
                    <button className='btn-cancel'>
                        CANCELAR
                    </button>
                    <button className='btn-retry'>
                        REINTENTAR
                    </button>
                </div>
            </div>
        </div>
    </Modal>
  )
}