import React, { useState } from 'react'
import { Modal } from 'react-bootstrap'
import './../Modal.scss'
import { RiCloseCircleLine } from 'react-icons/ri'
import trpc from "../../../api";
import { Spinner } from '../../../components/Spinner/Spinner';
import { IAdminUser } from '../../../interfaces/admin';
import { ErrorModal } from '../ErrorModal/ErrorModal';

interface ICondition {
    show: boolean;
    onHide: () => void;
    user: IAdminUser;
}

export function DeleteUOneUserModal(props: ICondition) {
    const { show, onHide, user } = props;
    const [loader, setLoader] = useState<boolean>(false);
    const [showError, setShowError] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const removeUser = async () => {
        setLoader(true);
        try {
            const deleted = await trpc.users.removeUserByAdminAction.mutate({
                userId: user.id,
                userEmail: user.email
            });

            console.log(deleted);
            onHide();
            setLoader(false);
            window.location.reload();
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
                      <RiCloseCircleLine className='icon' onClick={onHide} />
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
