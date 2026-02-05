import React, { useState } from 'react'
import { Modal } from 'react-bootstrap'
import './../Modal.scss'
import {RiCloseCircleLine} from 'react-icons/ri'
import trpc from "../../../api";
import { Spinner } from '../../../components/Spinner/Spinner';

interface IAdminFilter {
    page: number;
    total: number;
    search: string;
    active: number;
    limit: number
}
interface ICondition {
    show: boolean;
    onHide: () => void;
    filterUsers: (filters: IAdminFilter) => void;
    filters: IAdminFilter;
}
export function DeleteUserModal (props: ICondition)  {
    const {show, onHide} = props;
    const [loader, setLoader] = useState<boolean>(false);
    const removeUsersInactive =async () => {
        setLoader(true);
        try{
            const usr = await trpc.users.removeInactiveUsers.mutate();
            console.log(usr);
            onHide();
            setLoader(false);
        }catch(error: any){
            alert(error.message)
            setLoader(false);
        }
    };
  return (
    <Modal show={show} onHide={onHide} centered>
        <div className='modal-container success-modal'>
            <div className='header'>
                <p className='title'>Eliminar usuarios</p>
                <RiCloseCircleLine className='icon' onClick={onHide}/>
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
  )
}