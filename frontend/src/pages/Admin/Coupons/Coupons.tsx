import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import './Coupons.scss';
import { AddCouponModal } from "../../../components/Modals/AddCouponModal/AddCouponModal";
import { EditCouponModal } from "../../../components/Modals/EditCouponModal/EditCouponModal";
import { Spinner } from "../../../components/Spinner/Spinner";


export const Coupons = () => {

    const { currentUser } = useUserContext();
    const navigate = useNavigate();
    const [show, setShow] = useState<boolean>(false);
    const [showEdit, setShowEdit] = useState<boolean>(false);
    const [coupons, setCoupons] = useState<any>([]);
    const [loader, setLoader] = useState<boolean>(true);
    const [editingCoupon, setEditingCoupon] = useState(null);

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

    const handleRemoveCoupon = async (code: string) => {
        const userConfirmation = window.confirm('¿Estás seguro de que deseas eliminar el cupon?');
        if (userConfirmation) {
            try {
                await trpc.cupons.deleteStripeCupon.mutate({ code: code });
                setLoader(false);
                window.location.reload();
            }
            catch (error) {
                setLoader(false)
            }
        }
    }

    const handleEditCoupon = (coupon: any) => {
        setEditingCoupon(coupon);
        setShowEdit(true);
    };



    return (
        <div className='coupons-contain'>
            <div className='header'>
                <h1>Cupones</h1>
                <button className="btn-addCoupon" onClick={() => setShow(true)}>Crear Cupon</button>

                <AddCouponModal showModal={show} onHideModal={closeModalAdd} />
                <EditCouponModal showModal={showEdit} onHideModal={closeEditModalAdd} editingCoupon={editingCoupon} />
            </div>
            {!loader ? <div className="admin-table">
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
                                {/* <th>
                                    Condiciones
                                </th> */}
                                <th>
                                    Activo
                                </th>
                                <th>
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {(!loader && coupons.length > 0) ?
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
                                            {/* <td>
                                                {coupon.cupon_condition}
                                            </td> */}
                                            <td>
                                                {coupon.activated === 1 ? "Activo" : "No activo"}
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => handleEditCoupon(coupon)}
                                                >Editar</button>
                                                <button
                                                    onClick={() => handleRemoveCoupon(coupon.code)}
                                                >Eliminar</button>
                                            </td>
                                        </tr>

                                    )
                                })
                                : <tr>No se Encontraron Datos...</tr>
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
        </div>)
}
