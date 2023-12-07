import { useUserContext } from '../../contexts/UserContext';
import { useEffect } from 'react'
import { useNavigate } from "react-router-dom";

export const PlanAdmin = () => {

    const { currentUser } = useUserContext();
    const navigate = useNavigate();

    useEffect(() => {
        if (currentUser && currentUser.role !== "admin") {
            navigate('/');
        }
    }, [currentUser])

    return (
        <div className='planAdmin-container'>
            <h1>Administrar Planes</h1>
        </div>
    )
}
