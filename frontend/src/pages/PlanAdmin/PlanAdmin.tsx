import trpc from '../../api';
import * as Yup from "yup";
import './PlanAdmin.scss';
import { useUserContext } from '../../contexts/UserContext';
import { useEffect, useState } from 'react'
import { useNavigate } from "react-router-dom";
import AddPlanModal from '../../components/Modals/AddPlanModal/AddPlanModal';

export const PlanAdmin = () => {

    const { currentUser } = useUserContext();
    const navigate = useNavigate();
    const [show, setShow] = useState<boolean>(false);

    const closeModalAdd = () => {
        setShow(false);
    }

    useEffect(() => {
        if (currentUser && currentUser.role !== "admin") {
            navigate('/');
        }
    }, [currentUser])



    return (
        <div className='planAdmin-contain'>
            <div className='header'>
                <h1>Planes</h1>
                <button className="btn-addPlan" onClick={() => setShow(true)}>Crear Plan</button>
                <AddPlanModal showModal={show} onHideModal={closeModalAdd} />
            </div>
        </div>
    )
}
