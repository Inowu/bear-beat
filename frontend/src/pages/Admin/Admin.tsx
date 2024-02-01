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
import { ConditionModal } from "../../components/Modals/ConditionModal/ContitionModal";
import { FaLockOpen } from "react-icons/fa";
import { FaLock } from "react-icons/fa";

export interface IAdminFilter {
    page: number;
    total: number;
    search: string;
    active: number;
    limit: number
}
interface IDownloads {
    user_id: number;
    date_end: Date;
}
function Admin() {
    const { currentUser } = useUserContext();
    const [users, setUsers] = useState<IAdminUser[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [showModal, setShowModal] = useState<boolean>(false);
    const [showOption, setShowOption] = useState<boolean>(false);
    const [optionMessage, setOptionMessage] = useState<string>('');
    const [optionTitle, setOptionTitle] = useState<string>('');
    const [plans, setPlans] = useState<IPlans[]>([]);
    const [selectUser, setSelectUser] = useState({} as IAdminUser);
    const [loader, setLoader] = useState<boolean>(true);
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
    const [showBlockModal, setShowBlockModal] = useState<boolean>(false);
    const [blockModalMSG, setBlockModalMSG] = useState('');
    const [selectedUser, setSelectedUser] = useState({} as IAdminUser);
    const [blocking, setBlocking] = useState<boolean>(false);
    const [filters, setFilters] = useState<any>({
        page: 0,
        search: '',
        active: 2,
        limit: 100,
    })
    const closeModalAdd = () => {
        setShowModal(false);
    }
    const handleDeleteModal = () => {
        setShowDeleteModal(!showDeleteModal);
    }
    const closeBlockModal = () => {
        setShowBlockModal(false);
    }
    const openBlockModal = (user: IAdminUser, message: string, block: boolean) => {
        setBlocking(block);
        setBlockModalMSG(message);
        setShowBlockModal(true);
        setSelectedUser(user);
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
    const giveSuscription = (user: IAdminUser) => {
        setSelectUser(user);
        setOptionTitle('Seleccione el plan');
        openOption();
    }
    const removeUsersInactive = async () => {
        try{
            await trpc.users.removeInactiveUsers.mutate();
            handleDeleteModal();
            filterUsers(filters);
        }
        catch(error){
            console.log(error);
        }
    }
    const changeBlockUser = async () => {
        try{
            let body = {
                userId: selectedUser.id
            }
            if(blocking){
                const user_block = await trpc.users.blockUser.mutate(body)
            }else{
                const user_block = await trpc.users.unblockUser.mutate(body)
            }
            closeBlockModal();
            filterUsers(filters);
        }
        catch(error){
            console.log(error);
        }
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
                    take: filt.limit,
                    skip: filt.page * filt.limit,
                    where: {
                        email: {
                            startsWith: filt.search,
                        },
                    },
                    orderBy: {
                        registered_on: 'desc'
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
                    let body: any = {
                        take: filt.limit,
                        skip: filt.page * filt.limit,
                        where: {
                            email: {
                                startsWith: filt.search,
                            },
                        },
                        orderBy: {
                            registered_on: 'desc'
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
                    let tempUsers: any = [];
                    let totalUsersResponse = [];
                    if(filt.active === 1){
                        tempUsers = await trpc.users.getActiveUsers.query(body)
                        totalUsersResponse = await trpc.users.getActiveUsers.query(body2);
                    }else{
                        tempUsers = await trpc.users.getInactiveUsers.query(body)
                        totalUsersResponse = await trpc.users.getInactiveUsers.query(body2);
                    }
                    setUsers(tempUsers);
                    setTotalUsers(totalUsersResponse.length);
                    setLoader(false);
            }
        } catch (error) {
            console.log(error);
        }
    }
    useEffect(() => {
        getPlans();
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
                {/* <button className="btn-delete" style={{marginLeft:"auto"}} onClick={handleDeleteModal}>Eliminar Usuarios</button> */}
            </div>
            <div className="filter-contain">
                <div className="left-contain">
                    <div className="select-input">
                        <select onChange={(e)=> startFilter('active', +e.target.value)}>
                            <option value={2}>Todos</option>
                            <option value={1}>Activos</option>
                            <option value={0}>Inactivos</option>
                        </select>
                    </div>
                    <div className="select-input">
                        <select defaultValue={filters.limit} onChange={(e)=> startFilter('limit', +e.target.value)}>
                            <option value={''} disabled>Numero de datos</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                            <option value={500}>500</option>
                        </select>
                    </div>
                </div>

                <div className="search-input">
                    <input
                        placeholder="Buscar por email"
                        onChange={(e: any) => { startFilter('search', e.target.value) }}
                    />
                    <FontAwesomeIcon icon={faSearch} />
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
                                            <td className="wrap-td">
                                                <button onClick={() => { giveSuscription(user) }}>Activar Suscripcion</button>
                                                {
                                                    user.blocked ?
                                                        <FaLock className="lock" onClick={()=> openBlockModal(user, `Estas por desbloquear al usuario: ${user.username}`,false)}/>
                                                        : <FaLockOpen className="unlock"  onClick={()=> openBlockModal(user, `Estas por bloquear al usuario: ${user.username}`,true)}/>
                                                }
                                            </td>
                                        </tr>

                                    )
                                })
                                : ARRAY_10.map((val: string, index: number) => {
                                    return (
                                        
                                            filters.active !== 2 
                                            ?
                                            <tr key={"array_10" + index} className="tr-load">
                                                <td /><td /><td /><td /> <td/>
                                            </tr>
                                            :
                                            <tr key={"array_10" + index} className="tr-load">
                                                <td /><td /><td /><td />
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
                    limit = {filters.limit}
                />
            </div>
            <AddUsersModal showModal={showModal} onHideModal={closeModalAdd} />
            {/* <ConditionModal
                title={"Eliminar usuarios"}
                message={"Estas por eliminar a los usuarios que no se han suscrito, ni se han suscrito en el pasado mes."}
                show={showDeleteModal}
                onHide={handleDeleteModal}
                action={removeUsersInactive}
            /> */}
            <ConditionModal
                title={"Bloquear Usuario"}
                message={blockModalMSG}
                show={showBlockModal}
                onHide={closeBlockModal}
                action={changeBlockUser}
            />
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