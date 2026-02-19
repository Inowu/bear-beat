import React from 'react'
import './../Modal.scss'
import { Modal } from "src/components/ui"
import { XCircle } from "src/icons";
import { Button } from "src/components/ui";
interface ISuccess {
    show: boolean;
    onHide: () => void;
    title: string;
    message?: string;
}

export function SuccessCoupon(props: ISuccess) {
    const { show, onHide, title, message } = props;
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
                    <div className='button-container-2'>
                        <Button unstyled className='btn-success' onClick={onHide}>
                            Aceptar
                        </Button>
                    </div>
                </div>
            </div>
            <script>
            </script>
        </Modal>
    )
}
