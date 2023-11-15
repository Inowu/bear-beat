import React from 'react'
import './../Modal.scss'
import { Modal } from 'react-bootstrap'
import { RiCloseCircleLine } from 'react-icons/ri';
interface ISuccess {
  show: boolean;
  onHide: () => void;
  title: string;
  message?: string;
}

export function SuccessModal (props: ISuccess)  {
  const {show, onHide, title, message} = props;
  return (
    <Modal show={show} onHide={onHide} centered>
        <div className='modal-container success-modal'>
            <div className='header'>
                <p className='title'>{title}</p>
                <RiCloseCircleLine className='icon' onClick={onHide}/>
            </div>
            <div className='bottom'>
                <p className='content'>
                    {message?.toString()}
                </p>
                <div className='button-container-2'>
                  <button className='btn-success' onClick={onHide}>
                    Aceptar
                  </button>
                </div>
            </div>
        </div>
    </Modal>
  )
}
