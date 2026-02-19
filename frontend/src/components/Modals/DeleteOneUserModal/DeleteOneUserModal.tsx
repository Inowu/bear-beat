import React, { useState } from 'react'
import { Modal } from "src/components/ui"
import './../Modal.scss'
import { XCircle } from "src/icons"
import trpc from "../../../api";
import { Spinner } from '../../../components/Spinner/Spinner';
import { IAdminUser } from '../../../interfaces/admin';
import { ErrorModal } from '../ErrorModal/ErrorModal';
import { Button } from "src/components/ui";
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
                          <Button unstyled className='btn-option-5' onClick={onHide}>
                              Cancelar
                          </Button>
                          {
                              !loader
                                  ? <Button unstyled className='btn-option-4' onClick={removeUser}>
                                      Confirmar
                                  </Button>
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
