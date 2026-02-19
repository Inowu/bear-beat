import './../Modal.scss'
import './SuccessModal.scss'
import { Modal } from '../../ui/Modal/Modal'
import { XCircle } from "src/icons";
import { Button } from "src/components/ui";
interface ISuccess {
  show: boolean;
  onHide: () => void;
  title: string;
  message?: string;
}

export function SuccessModal(props: ISuccess) {
  const { show, onHide, title, message } = props;
  return (
    <Modal open={show} onClose={onHide} className='container-success-modal'>
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
    </Modal>
  )
}
