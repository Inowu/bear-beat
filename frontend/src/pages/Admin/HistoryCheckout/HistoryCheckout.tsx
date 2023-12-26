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
            const history: any = await trpc.checkoutLogs.registerCheckoutLog.mutate();
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
