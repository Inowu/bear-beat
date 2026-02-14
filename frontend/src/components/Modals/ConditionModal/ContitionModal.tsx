import React, { useState } from 'react'
import { Modal } from 'react-bootstrap'
import './../Modal.scss'
import { XCircle } from "src/icons"
import { Spinner } from '../../../components/Spinner/Spinner';
interface ICondition {
    show: boolean;
    onHide: () => void;
    action: () => void;
    title: string;
    message?: string;
}
export function ConditionModal (props: ICondition)  {
    const {show, onHide, message, action, title} = props;
    const [loader, setLoader] = useState<boolean>(false);
    const startAction = async () => {
      setLoader(true);
      await action();
      setLoader(false);
      onHide();
    }
  return (
    <Modal show={show} onHide={onHide} centered>
        <div className='modal-container success-modal'>
            <div className='header'>
                <p className='title'>{title}</p>
                <XCircle className='icon' onClick={onHide} aria-label="Cerrar" />
            </div>
            <div className='bottom'>
                <p className='content'>
                    {message?.toString()}
                </p>
                <div className='button-container'>
                  <button className='btn-option-5' onClick={onHide}>
                    Cancelar
                  </button>
                  {
                    !loader 
                    ? <button className='btn-option-4' onClick={startAction}>
                      Confirmar
                    </button>
                    : <div style={{width: 189}}><Spinner size={3} width={.3} color="var(--app-accent)"/></div>
                  }
                </div>
            </div>
        </div>
    </Modal>
  )
}
