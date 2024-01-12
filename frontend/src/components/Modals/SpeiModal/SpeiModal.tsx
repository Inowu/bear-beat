import React from 'react'
import { Modal } from 'react-bootstrap'
import './../Modal.scss'
import { RiCloseCircleLine } from 'react-icons/ri'
import { ISpeiData } from 'interfaces/Plans';
interface ISpei {
    show: boolean;
    onHide: () => void;
    speiData: ISpeiData;
    price: string;
}
export function SpeiModal(props: ISpei) {
    const { show, onHide, speiData, price } = props;
    const transformDate = (expires: number) => {
        const date = new Date(expires * 1000); // Convert to milliseconds
        const dateString = date.toLocaleString();
        return dateString
    }
    return (
        <Modal show={show} onHide={onHide} centered>
            <div className='modal-container success-modal'>
                <div className='header'>
                    <p className='title'>Pago con Spei</p>
                    <RiCloseCircleLine className='icon' onClick={onHide} />
                </div>
                <div className='bottom center'>
                    <p className='content'>
                        BearBeat te invita a pagar con conekta con Spei:
                    </p>
                    <p className='reference'>
                        *Ingresa a la plataforma después de realizar tu transferencia bancaria
                    </p>
                    <p className='pay-reference'>
                        Clabe interbancaria: {speiData.clabe}
                    </p>
                    <p className='content'>
                        Monto a Pagar: <br /> $ {price}.00 MXN
                    </p>
                    <p className='reference'>
                        Paga antes del: {transformDate(speiData.expires_at)}
                    </p>
                    <div className='button-container to-left'>
                        <button className='btn-option-4' onClick={onHide}>
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}