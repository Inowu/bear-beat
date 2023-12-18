import trpc from "../../api";
import AddPlanModal from "../../components/Modals/AddPlanModal/AddPlanModal";
import EditPlanModal from "../../components/Modals/EditPlanModal/EditPlanModal";
import { useUserContext } from "../../contexts/UserContext";
import { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import './Coupons.scss';



export const Coupons = () => {

    const { currentUser } = useUserContext();
    const navigate = useNavigate();
    const [show, setShow] = useState<boolean>(false);
    const [showEdit, setShowEdit] = useState<boolean>(false);
    const [coupons, setCoupons] = useState<any>([]);
    const [loader, setLoader] = useState<boolean>(true);
    const [editingPlan, setEditingPlan] = useState(null);

    const getCoupons = async () => {
        let body = {
            where: {

            }
        }
        try {
            const coupons: any = await trpc.cupons.findManyCupons.query(body);
            setCoupons(coupons);
            console.log(coupons)
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
        getCoupons();
    }, [])

    const handleRemoveCoupon = async (id: number, plan: any) => {
        console.log(id, plan)
        const userConfirmation = window.confirm('¿Estás seguro de que deseas eliminar el plan?');
        if (userConfirmation) {
            try {
                await trpc.cupons.deleteOneCupons.mutate({ where: { id: id } });
                setLoader(false);
                window.location.reload();
            }
            catch (error) {
                setShow(true);
                setLoader(false)
            }
        }
    }

    const handleEditPlan = (plan: any) => {
        setEditingPlan(plan);
        setShowEdit(true);
    };



    return (
        <div className='coupons-contain'>
            <div className='header'>
                <h1>Cupones</h1>
                <button className="btn-addCoupon" onClick={() => setShow(true)}>Crear Cupon</button>

                {/* <AddPlanModal showModal={show} onHideModal={closeModalAdd} /> */}
                {/* <EditPlanModal showModal={showEdit} onHideModal={closeEditModalAdd} editingPlan={editingPlan} /> */}
            </div>
            <div className="admin-table">
                <div className="table-contain">
                    <table>
                        <thead>
                            <tr>
                                <th>
                                    Codigo
                                </th>
                                <th>
                                    Descripción
                                </th>
                                <th>
                                    Descuento
                                </th>
                                <th>
                                    Condiciones
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
                                coupons.map((coupon: any, index: number) => {
                                    return (
                                        <tr key={"admin_coupons_" + index}>
                                            <td className="">
                                                {coupon.code}
                                            </td>
                                            <td>
                                                {coupon.description}
                                            </td>
                                            <td>
                                                {coupon.discount} %
                                            </td>
                                            <td>
                                                {coupon.cupon_condition}
                                            </td>
                                            <td>
                                                {coupon.activated === 1 ? "Activo" : "No activo"}
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => handleEditPlan(coupon)}
                                                >Editar</button>
                                                <button
                                                    onClick={() => handleRemoveCoupon(coupon.id, coupon.paypal_plan_id)}
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
        </div>)
}
