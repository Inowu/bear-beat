import React, { useState } from 'react'
import { Modal } from '../../ui/Modal/Modal'
import './../Modal.scss'
import { XCircle } from "src/icons"
import { Spinner } from '../../../components/Spinner/Spinner';
import { Button } from "src/components/ui";
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
    <Modal open={show} onClose={onHide} size="sm" className="condition-download-modal">
        <div className='modal-container success-modal condition-download-modal__panel'>
            <div className='header'>
                <p className='title'>{title}</p>
                <XCircle className='icon' onClick={onHide} aria-label="Cerrar" />
            </div>
            <div className='bottom'>
                <p className='content'>
                    {message?.toString()}
                </p>
                <div className='button-container'>
                  <Button unstyled className='btn-option-5' onClick={onHide}>
                    Cancelar
                  </Button>
                  {
                    !loader 
                    ? <Button unstyled className='btn-option-4' onClick={startAction}>
                      Confirmar
                    </Button>
                    : <div className="condition-download-modal__spinner"><Spinner size={3} width={.3} color="var(--app-accent)"/></div>
                  }
                </div>
            </div>
        </div>
    </Modal>
  )
}
