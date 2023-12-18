import trpc from '../../api';
import * as Yup from "yup";
import './PlanAdmin.scss';
import { useUserContext } from '../../contexts/UserContext';
import { useEffect, useState } from 'react'
import { useNavigate } from "react-router-dom";
import AddPlanModal from '../../components/Modals/AddPlanModal/AddPlanModal';
import { IPlans } from 'interfaces/Plans';
import EditPlanModal from '../../components/Modals/EditPlanModal/EditPlanModal';

export const PlanAdmin = () => {

    const { currentUser } = useUserContext();
    const navigate = useNavigate();
    const [show, setShow] = useState<boolean>(false);
    const [showEdit, setShowEdit] = useState<boolean>(false);
    const [plans, setPlans] = useState<any>([]);
    const [loader, setLoader] = useState<boolean>(true);
    const [editingPlan, setEditingPlan] = useState(null);


    const getPlans = async () => {
        let body = {
            where: {

            }
        }
        try {
            const plans: any = await trpc.plans.findManyPlans.query(body);
            setPlans(plans);
            console.log(plans)
            setLoader(false);
        }
        catch (error) {
            console.log(error);
        }
    }

    const closeModalAdd = () => {
        setShow(false);
    }
    const closeEditModalAdd = () => {
        setShowEdit(false);
    }

    useEffect(() => {
        if (currentUser && currentUser.role !== "admin") {
            navigate('/');
        }
    }, [currentUser])
    useEffect(() => {
        getPlans();
    }, [])

    const handleRemovePlan = async (id: number, plan: any) => {
        console.log(id, plan)
        const userConfirmation = window.confirm('¿Estás seguro de que deseas eliminar el plan?');
        if (userConfirmation) {
            try {
                await trpc.plans.deleteOnePlans.mutate({ where: { id: id } });
                // setShowSuccess(true);
                setLoader(false);
                window.location.reload();
            }
            catch (error) {
                setShow(true);
                // setErrorMessage(error);
                setLoader(false)
            }
        }
    }

    const handleEditPlan = (plan: any) => {
        setEditingPlan(plan);
        setShowEdit(true);
    };



    return (
        <div className='planAdmin-contain'>
            <div className='header'>
                <h1>Planes</h1>
                <button className="btn-addPlan" onClick={() => setShow(true)}>Crear Plan</button>

                <AddPlanModal showModal={show} onHideModal={closeModalAdd} />
                <EditPlanModal showModal={showEdit} onHideModal={closeEditModalAdd} editingPlan={editingPlan} />
            </div>
            <div className="admin-table">
                <div className="table-contain">
                    <table>
                        <thead>
                            <tr>
                                <th>
                                    Nombre
                                </th>
                                <th>
                                    Descripción
                                </th>
                                <th>
                                    Moneda
                                </th>
                                <th>
                                    Precio
                                </th>
                                <th>
                                    Activo
                                </th>
                                <th>
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loader ?
                                plans.map((plan: IPlans, index: number) => {
                                    return (
                                        <tr key={"admin_plans_" + index}>
                                            <td className="">
                                                {plan.name}
                                            </td>
                                            <td>
                                                {plan.description}
                                            </td>
                                            <td>
                                                {plan.moneda}
                                            </td>
                                            <td>
                                                {plan.price}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {plan.activated === 1 ? "Activo" : "No activo"}
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => handleEditPlan(plan)}
                                                    disabled={plan.paypal_plan_id !== null}
                                                >Editar</button>
                                                <button
                                                    onClick={() => handleRemovePlan(plan.id, plan.paypal_plan_id)}
                                                    disabled={plan.paypal_plan_id !== null}
                                                >Eliminar</button>
                                            </td>
                                        </tr>

                                    )
                                })
                                : <h1>No se Encontraron Datos...</h1>
                            }
                        </tbody>
                    </table>
                </div>
                {/* <Pagination
                        totalData={totalUsers}
                        title="usuarios"
                        startFilter={startFilter}
                        currentPage={filters.page}
                    /> */}
            </div>
        </div>
    )
}
