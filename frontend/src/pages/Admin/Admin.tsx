import { useEffect, useState } from "react";
import { useUserContext } from "../../contexts/UserContext";
import trpc from "../../api";
import { IAdminUser } from "../../interfaces/admin";
import './Admin.scss';
import { Spinner } from "../../components/Spinner/Spinner";
import { IPlans } from "../../interfaces/Plans";
import { OptionModal } from "../../components/Modals/OptionModal/OptionModal";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import Pagination from "../../components/Pagination/Pagination";
import { ARRAY_10 } from "../../utils/Constants";
import AddUsersModal from "../../components/Modals/AddUsersModal/AddUsersModal";
import CsvDownloader from 'react-csv-downloader';
import {  exportUsers } from "./fuctions";

export interface IAdminFilter {
    page: number;
    total: number;
    search: string;
    active: number;
}
interface IDownloads {
    user_id: number;
    date_end: Date;
}
function Admin() {
    const { currentUser } = useUserContext();
    const [users, setUsers] = useState<IAdminUser[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [storage, setStorage] = useState();
    const [showModal, setShowModal] = useState<boolean>(false);
    const [showOption, setShowOption] = useState<boolean>(false);
    const [optionMessage, setOptionMessage] = useState<string>('');
    const [optionTitle, setOptionTitle] = useState<string>('');
    const [plans, setPlans] = useState<IPlans[]>([]);
    const [selectUser, setSelectUser] = useState({} as IAdminUser);
    const [loader, setLoader] = useState<boolean>(true);
    // const [userDownloads, setUserDownloads] = useState<any>([]);
    const [filters, setFilters] = useState<any>({
        page: 0,
        search: '',
        active: 2,
    })
    const closeModalAdd = () => {
        setShowModal(false);
    }
    const navigate = useNavigate();
    const openOption = () => {
        setShowOption(true);
    }
    const closeOption = () => {
        setSelectUser({} as IAdminUser);
        setShowOption(false);
    }
    const plan_1 = () => {
        closeOption();
        activateSubscription(plans[0])
    }
    const plan_2 = () => {
        closeOption();
        activateSubscription(plans[1])
    }
    const getPlans = async () => {
        let body = {
            where: {
                activated: 1,
            }
        }
        try {
            const plans: any = await trpc.plans.findManyPlans.query(body);
            setPlans(plans);
        }
        catch (error) {
            console.log(error);
        }
    }
    // const getStorage = async () => {
    //     let body = {
    //     }
    //     try {
    //         const storage: any = await trpc.ftp.storage.query(body)
    //         setStorage(storage);
    //         console.log(storage)
    //     }
    //     catch (error) {
    //         console.log(error);
    //     }
    // }
    const giveSuscription = (user: IAdminUser) => {
        setSelectUser(user);
        setOptionTitle('Seleccione el plan');
        openOption();
    }
    const activateSubscription = async (plan: IPlans) => {
        try {
            let body = {
                planId: plan.id,
                userId: selectUser.id
            }
            const activate = await trpc.admin.activatePlanForUser.mutate(body);
            alert('Plan activado con éxito!')
        }
        catch (error) {
            console.log(error)
        }
    }
    // const getDownloads = async () => {
    //     const today = new Date();
    //     let body_descarga = {
    //         where: {
    //             date_end: {
    //                 gte: today,
    //             },
    //         },
    //         select: {
    //             user_id: true,
    //             date_end: true,
    //         },
    //     }
    //     const descargasUser = await trpc.descargasuser.findManyDescargasUser.query(body_descarga);
    //     setUserDownloads(descargasUser);
    // }
    const startFilter = (key: string, value: string | number) => {
        let tempFilters: any = filters;
        if (key !== 'page') {
            tempFilters.page = 0;
        }
        tempFilters[key] = value;
        filterUsers(tempFilters);
        setFilters(tempFilters);
    }
    const filterUsers = async (filt: IAdminFilter) => {
        setLoader(true);
        try {
            if (filt.active === 2) {
                let body: any = {
                    take: 10,
                    skip: filt.page * 10,
                    where: {
                        email: {
                            startsWith: filt.search,
                        },
                    }
                }
                let body2: any = {
                    where: {
                        email: {
                            startsWith: filt.search,
                        },
                    },
                    select: {
                        id: true,
                    },
                }
                const tempUsers = await trpc.users.findManyUsers.query(body);
                const totalUsersResponse = await trpc.users.findManyUsers.query(body2);
                setLoader(false);
                setUsers(tempUsers);
                setTotalUsers(totalUsersResponse.length);
            } 
            else {
                if(filt.active === 1){
                    let body: any = {
                        take: 10,
                        skip: filt.page * 10,
                        where: {
                            email: {
                                startsWith: filt.search,
                            },
                        }
                    }
                    let body2: any = {
                        where: {
                            email: {
                                startsWith: filt.search,
                            }
                        },
                        select: {
                            id: true,
                        },
                    }
                    const tempUsers: any = await trpc.users.getActiveUsers.query(body)
                    const totalUsersResponse = await trpc.users.getActiveUsers.query(body2);
                    setLoader(false);
                    setUsers(tempUsers);
                    setTotalUsers(totalUsersResponse.length);
                }
                else{
                    let body: any = {
                        take: 10,
                        skip: filt.page * 10,
                        where: {
                            email: {
                                startsWith: filt.search,
                            }
                        }
                    }
                    let body2: any = {
                        where: {
                            email: {
                                startsWith: filt.search,
                            },
                        },
                        select: {
                            id: true,
                        },
                    }
                    const tempUsers: any = await trpc.users.getInactiveUsers.query(body)
                    const totalUsersResponse = await trpc.users.getInactiveUsers.query(body2);
                    setLoader(false);
                    setUsers(tempUsers);
                    setTotalUsers(totalUsersResponse.length);
                }
            }
        } catch (error) {
            console.log(error);
        }
    }
    useEffect(() => {
        getPlans();
        // getStorage();
        // getDownloads();
        filterUsers(filters);
    }, [])
    useEffect(() => {
        if (currentUser && currentUser.role !== "admin") {
            navigate('/');
        }
    }, [currentUser])

    const transformUserData = async () => {
        const tempUsers: any = await exportUsers(filters);
        return tempUsers.map((user:any) => ({
            Usuario: user.username,
            Correo: user.email,
            Fecha_de_Registro: user.registered_on.toLocaleDateString(),
        }));
    };
    return (
        <div className="admin-contain">
            <div className="header">
                <h1>Usuarios</h1>
                <button className="btn-addUsers" onClick={() => setShowModal(true)}>Añadir Usuarios</button>
                    <CsvDownloader 
                        className="btn-addUsers"
                        filename="lista_de_usuarios"
                        extension=".csv"
                        separator=";"
                        wrapColumnChar="'"
                        datas={transformUserData()}
                        text="Exportar Clientes" 
                    />
                <div className="search-input">
                    <input
                        placeholder="Buscar por email"
                        onChange={(e: any) => { startFilter('search', e.target.value) }}
                    />
                    <FontAwesomeIcon icon={faSearch} />
                </div>
                <AddUsersModal showModal={showModal} onHideModal={closeModalAdd} />
            </div>
            <div className="filter-contain">
                <div className="select-input">
                    <select onChange={(e)=> startFilter('active', +e.target.value)}>
                        <option value={2}>Todos</option>
                        <option value={1}>Activos</option>
                        <option value={0}>Inactivos</option>
                    </select>
                </div>
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
                                    Email
                                </th>
                                <th>
                                    Registro
                                </th>
                                {
                                    filters.active !== 2 &&
                                    <th>
                                        Suscripción
                                    </th>
                                }

                                <th>
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loader ?
                                users.map((user: IAdminUser, index: number) => {
                                    return (
                                        <tr key={"admin_users_" + index}>
                                            <td className="">
                                                {user.username}
                                            </td>
                                            <td>
                                                {user.email}
                                            </td>
                                            <td>
                                                {user.registered_on.toLocaleDateString()}
                                            </td>
                                            {
                                                filters.active !== 2 && 
                                                <td >
                                                    {filters.active === 1? "Activa" : "No activa"}
                                                </td>
                                            }
                                            <td>
                                                <button onClick={() => { giveSuscription(user) }}>Activar Suscripcion</button>
                                            </td>
                                        </tr>

                                    )
                                })
                                : ARRAY_10.map((val: string, index: number) => {
                                    return (
                                        <tr key={"array_10" + index} className="tr-load">
                                            <td /><td /><td /><td /><td />
                                        </tr>
                                    )
                                })
                            }
                        </tbody>
                    </table>
                </div>
                <Pagination
                    totalData={totalUsers}
                    title="usuarios"
                    startFilter={startFilter}
                    currentPage={filters.page}
                />
            </div>
            <OptionModal
                show={showOption}
                onHide={closeOption}
                title={optionTitle}
                message={optionMessage}
                action={plan_1}
                action2={plan_2}
            />
        </div>
    )
}
export default Admin;