import React, { useState } from 'react'
import { Modal } from 'react-bootstrap'
import './../Modal.scss'
import { XCircle } from "src/icons"
import trpc from "../../../api";
import { Spinner } from '../../../components/Spinner/Spinner';
import { ErrorModal } from '../ErrorModal/ErrorModal';

interface IAdminFilter {
    page: number;
    total: number;
    search: string;
    active: 0 | 1 | 2 | 3;
    limit: number
}
interface ICondition {
    show: boolean;
    onHide: () => void;
    filterUsers: (filters: IAdminFilter) => void | Promise<void>;
    filters: IAdminFilter;
}
export function DeleteUserModal (props: ICondition)  {
    const {show, onHide} = props;
    const [loader, setLoader] = useState<boolean>(false);
    const [showError, setShowError] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const removeUsersInactive =async () => {
        setLoader(true);
        try{
            await trpc.users.removeInactiveUsers.mutate();
            onHide();
            setLoader(false);
        }catch(error: any){
            setErrorMessage(error.message ?? "No se pudo completar la acción.");
            setShowError(true);
            setLoader(false);
        }
    };
  return (
    <>
      <Modal show={show} onHide={onHide} centered>
          <div className='modal-container success-modal'>
              <div className='header'>
                  <p className='title'>Eliminar usuarios</p>
                  <XCircle className='icon' onClick={onHide} aria-label="Cerrar" />
              </div>
              <div className='bottom'>
                  <p className='content'>
                      Estas por eliminar a los usuarios que no se han suscrito, ni se han suscrito en el pasado mes.
                  </p>
                  <div className='button-container'>
                    <button className='btn-option-5' onClick={onHide}>
                      Cancelar
                    </button>
                    {
                      !loader 
                      ? <button className='btn-option-4' onClick={removeUsersInactive}>
                        Confirmar
                      </button>
                      : <div style={{width: 189}}><Spinner size={3} width={.3} color="var(--app-accent)"/></div>
                    }
                  </div>
              </div>
          </div>
      </Modal>
      <ErrorModal show={showError} onHide={() => setShowError(false)} message={errorMessage} />
    </>
  )
}
