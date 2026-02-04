import trpc from '../../../api';
import * as Yup from "yup";
import './PlanAdmin.scss';
import { useUserContext } from '../../../contexts/UserContext';
import { useEffect, useState } from 'react'
import { useNavigate } from "react-router-dom";
import AddPlanModal from '../../../components/Modals/AddPlanModal/AddPlanModal';
import { IPlans } from 'interfaces/Plans';
import EditPlanModal from '../../../components/Modals/EditPlanModal/EditPlanModal';
import { Spinner } from "../../../components/Spinner/Spinner";

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
            where: {}
        }
        try {
            const plans: any = await trpc.plans.findManyPlans.query(body);
            setPlans(plans);
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
    const handleRemovePlan = async (id: number, plan: any) => {
        const userConfirmation = window.confirm('¿Estás seguro de que deseas eliminar el plan?');
        if (userConfirmation) {
            try {
                await trpc.plans.deleteOnePlans.mutate({ where: { id: id } });
                // setShowSuccess(true);
                getPlans();
                setLoader(false);
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

    const getPaymentMethod = (plan: IPlans) => {
        if (plan.paypal_plan_id || plan.paypal_plan_id_test) {
            return 'PayPal';
        } else {
            return 'Stripe'
        }
    }

    useEffect(() => {
        if (currentUser && currentUser.role !== "admin") {
            navigate('/');
        }
    }, [currentUser])

    useEffect(() => {
        getPlans();
    }, [])

    return (
        <div className='planAdmin-contain'>
            <div className='header'>
                <h1>Planes - {plans.length}</h1>
                <button className="btn-addPlan" onClick={() => setShow(true)}>Crear Plan</button>

                <AddPlanModal showModal={show} onHideModal={closeModalAdd} callPlans={getPlans} />
                <EditPlanModal showModal={showEdit} onHideModal={closeEditModalAdd} editingPlan={editingPlan} callPlans={getPlans} />
            </div>
            {!loader ? <div className="admin-table">
                <div className="table-contain">
                    <table>
                        <thead>
                            <tr>
                                <th>
                                    Nombre
                                </th>
                                <th>
                                    Método de pago
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
                            {!loader &&
                                plans.map((plan: IPlans, index: number) => {
                                    return (
                                        <tr key={"admin_plans_" + index}>
                                            <td data-label="Nombre">
                                                {plan.name}
                                            </td>
                                            <td data-label="Método de pago">
                                                {getPaymentMethod(plan)}
                                            </td>
                                            <td data-label="Descripción">
                                                {plan.description}
                                            </td>
                                            <td data-label="Moneda">
                                                {plan.moneda.toUpperCase()}
                                            </td>
                                            <td data-label="Precio">
                                                {plan.price}
                                            </td>
                                            <td data-label="Activo" style={{ textAlign: 'center' }}>
                                                {plan.activated === 1 ? "Activo" : "No activo"}
                                            </td>
                                            <td data-label="Acciones">
                                                <button
                                                    onClick={() => handleEditPlan(plan)}
                                                    // disabled={plan.paypal_plan_id !== null}
                                                    style={{ marginRight: 10 }}
                                                >Editar</button>
                                                <button
                                                    onClick={() => handleRemovePlan(plan.id, plan.paypal_plan_id)}
                                                    disabled={plan.paypal_plan_id !== null}
                                                    className={plan.paypal_plan_id !== null ? 'disable' : ''}
                                                >Eliminar</button>
                                            </td>
                                        </tr>

                                    )
                                })

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
            </div> :
                <Spinner size={3} width={.3} color="#00e2f7" />}
        </div>
    )
}
