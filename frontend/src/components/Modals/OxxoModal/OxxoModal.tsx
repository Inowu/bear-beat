import React from 'react'
import { Modal } from 'react-bootstrap'
import './../Modal.scss'
import { XCircle } from 'lucide-react'
import { IOxxoData } from 'interfaces/Plans';
interface IOxxo {
    show: boolean;
    onHide: () => void;
    oxxoData: IOxxoData;
    price: string;
}
export function OxxoModal (props: IOxxo)  {
    const {show, onHide, oxxoData, price} = props;
    const transformDate = (expires: number) => {
        const date = new Date(expires * 1000); // Convert to milliseconds
        const dateString = date.toLocaleString();
        return dateString
    }
  return (
    <Modal show={show} onHide={onHide} centered>
        <div className='modal-container success-modal'>
            <div className='header'>
                <p className='title'>Pago con Oxxo</p>
                <XCircle className='icon' onClick={onHide} aria-label='Cerrar modal' />
            </div>
            <div className='bottom center'>
                <p className='content'>
                BearBeat te invita a pagar con conekta en Oxxo:
                </p>
                <p className='reference'>
                *Los pagos en oxxo tardan en reflejarse hasta 48 hrs.
                </p>
                <p className='reference'>
                *Ingresa a la plataforma después de este tiempo para tener validado tu pago
                </p>
                <p className='pay-reference'>
                   Referencia: {oxxoData.reference}
                </p>
                <img src={oxxoData.barcode_url} alt='Código de barras para pago en OXXO' />
                <p className='content'>
                Monto a Pagar: <br/> $ {price}.00 MXN
                </p>
                <p className='reference'>
                   Paga antes del: { transformDate(oxxoData.expires_at)}
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
