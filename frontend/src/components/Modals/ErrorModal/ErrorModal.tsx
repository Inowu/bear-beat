import { Modal } from 'react-bootstrap'
import './../Modal.scss'
import './ErrorModal.scss'
import { RiCloseCircleLine } from 'react-icons/ri'
import { IUser } from '../../../interfaces/User';
interface IError {
  show: boolean;
  onHide: () => void;
  user?: IUser | null;
  message?: string;
}
export function ErrorModal(props: IError) {
  const { show, onHide, message, user } = props;
  return (
    <Modal show={show} onHide={onHide} centered className='container-error-modal'>
      <div className='modal-container error-modal'>
        <div className='header'>
          <p className='title'>Error</p>
          <RiCloseCircleLine className='icon' onClick={onHide} />
        </div>
        <div className='bottom'>
          <p className='content'>
            {message?.toString()}
          </p>
          {
            user &&
            <>
              <p className='content'><b>Email:</b> {user.email}</p>
              {
                user.ftpAccount &&
                <p className='content'><b>Fecha de expiración:</b> {user.ftpAccount.expiration?.toDateString()}</p>
              }

            </>
          }
          <div className='button-container-2'>
            <button className='btn-cancel' onClick={onHide}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}