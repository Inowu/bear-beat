import './../Modal.scss'
import './SuccessModal.scss'
import { Modal } from 'react-bootstrap'
import { XCircle } from 'lucide-react';
interface ISuccess {
  show: boolean;
  onHide: () => void;
  title: string;
  message?: string;
}

export function SuccessModal(props: ISuccess) {
  const { show, onHide, title, message } = props;
  return (
    <Modal show={show} onHide={onHide} centered className='container-success-modal'>
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
            <button className='btn-success' onClick={onHide}>
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
