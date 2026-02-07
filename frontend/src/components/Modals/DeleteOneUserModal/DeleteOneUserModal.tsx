import React, { useState } from 'react'
import { Modal } from 'react-bootstrap'
import './../Modal.scss'
import { XCircle } from 'lucide-react'
import trpc from "../../../api";
import { Spinner } from '../../../components/Spinner/Spinner';
import { IAdminUser } from '../../../interfaces/admin';
import { ErrorModal } from '../ErrorModal/ErrorModal';

interface ICondition {
    show: boolean;
    onHide: () => void;
    user: IAdminUser;
    onDeleted?: () => void;
}

export function DeleteUOneUserModal(props: ICondition) {
    const { show, onHide, user, onDeleted } = props;
    const [loader, setLoader] = useState<boolean>(false);
    const [showError, setShowError] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const removeUser = async () => {
        setLoader(true);
        try {
            await trpc.users.removeUserByAdminAction.mutate({
                userId: user.id,
                userEmail: user.email
            });
            onHide();
            onDeleted?.();
            setLoader(false);
        } catch (error: any) {
            setErrorMessage(error.message ?? "No se pudo eliminar el usuario.");
            setShowError(true);
            setLoader(false);
        }
    };
    return (
        <>
          <Modal show={show} onHide={onHide} centered>
              <div className='modal-container success-modal'>
                  <div className='header'>
                      <p className='title'>Eliminar usuario</p>
                      <XCircle className='icon' onClick={onHide} aria-label="Cerrar" />
                  </div>
                  <div className='bottom'>
                      <p className='content'>
                          Estas por eliminar a este usuario para siempre, por favor confirma que deseas eliminarlo.
                      </p>
                      <div className='button-container'>
                          <button className='btn-option-5' onClick={onHide}>
                              Cancelar
                          </button>
                          {
                              !loader
                                  ? <button className='btn-option-4' onClick={removeUser}>
                                      Confirmar
                                  </button>
                                  : <div style={{ width: 189 }}><Spinner size={3} width={.3} color="var(--app-accent)" /></div>
                          }
                      </div>
                  </div>
              </div>
          </Modal>
          <ErrorModal show={showError} onHide={() => setShowError(false)} message={errorMessage} />
        </>
    )
}
