import trpc from '../../../api';
import { useUserContext } from '../../../contexts/UserContext';
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom';

export const HistoryCheckout = () => {

    const { currentUser } = useUserContext();
    const navigate = useNavigate();
    const [history, setHistory] = useState<any>([]);
    const [loader, setLoader] = useState<boolean>(true);

    const getHistory = async () => {
        try {
            const history: any = await trpc.checkoutLogs.getCheckoutLogs.query()
            setHistory(history);
            console.log(history)
            setLoader(false);
        }
        catch (error) {
            console.log(error);
        }
    }

    useEffect(() => {
        if (currentUser && currentUser.role !== "admin") {
            navigate('/');
        }
    }, [currentUser])
    useEffect(() => {
        getHistory();
    }, [])

    return (
        <div className='coupons-contain'>
            <div className='header'>
                <h1>Historial</h1>
            </div>
            <div className="admin-table">
                <div className="table-contain">
                    <table>
                        <thead>
                            <tr>
                                <th>
                                    Email
                                </th>
                                <th>
                                    Teléfono
                                </th>
                                <th>
                                    Ultima Fecha de Pago
                                </th>
                                <th>
                                    Estado
                                </th>
                                
                            </tr>
                        </thead>
                        <tbody>
                            {!loader ?
                                history.map((his: any, index: number) => {
                                    return (
                                        <tr key={"admin_history_" + index}>
                                            <td className="">
                                                {his.users.email}
                                            </td>
                                            <td>
                                                {his.users.phone}
                                            </td>
                                            <td>
                                                {his.last_checkout_date.toLocaleDateString()}
                                            </td>
                                            <td>
                                                {his.users.active === 1 ? "Activo" : "No activo"}
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
            </div>
        </div>
    )
}
