import { useEffect, useState } from "react";
import { useUserContext } from "../../contexts/UserContext";
import trpc from "../../api";
import { IAdminUser, USER_ROLES } from "../../interfaces/admin";
import "./Admin.scss";
import { IPlans } from "../../interfaces/Plans";
import {
  AddUsersModal,
  ConditionModal,
  DeleteUserModal,
  ErrorModal,
  OptionModal,
  EditUserModal,
  HistoryModal,
  AddExtraStorageModal,
  DeleteUOneUserModal
} from '../../components/Modals'
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import Pagination from "../../components/Pagination/Pagination";
import { ARRAY_10 } from "../../utils/Constants";
import CsvDownloader from "react-csv-downloader";
import { exportUsers } from "./fuctions";
import { FaLockOpen } from "react-icons/fa";
import { FaLock } from "react-icons/fa";
import { useSSE } from "react-hooks-sse";
import { of } from "await-of";

export interface IAdminFilter {
  page: number;
  total: number;
  search: string;
  active: number;
  limit: number;
}

function Admin() {
  const { currentUser, handleLogin } = useUserContext();
  const [users, setUsers] = useState<IAdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showOption, setShowOption] = useState<boolean>(false);
  const [optionTitle, setOptionTitle] = useState<string>("");
  const [plans, setPlans] = useState<IPlans[]>([]);
  const [selectUser, setSelectUser] = useState({} as IAdminUser);
  const [loader, setLoader] = useState<boolean>(true);
  const [totalLoader, setTotalLoader] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showBlockModal, setShowBlockModal] = useState<boolean>(false);
  const [blockModalMSG, setBlockModalMSG] = useState("");
  const [selectedUser, setSelectedUser] = useState({} as IAdminUser);
  const [blocking, setBlocking] = useState<boolean>(false);
  const [showEdit, setShowEdit] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [filters, setFilters] = useState<any>({
    page: 0,
    search: "",
    active: 2,
    limit: 100,
  });
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showAddGB, setShowAddGB] = useState<boolean>(false);
  const [showDeleteUser, setShowDeleteUser] = useState<boolean>(false);

  const closeModalAdd = () => {
    setShowModal(false);
  };
  const handleDeleteModal = () => {
    setShowDeleteModal(!showDeleteModal);
  };
  const closeBlockModal = () => {
    setShowBlockModal(false);
  };
  const openBlockModal = (
    user: IAdminUser,
    message: string,
    block: boolean
  ) => {
    setBlocking(block);
    setBlockModalMSG(message);
    setShowBlockModal(true);
    setSelectedUser(user);
  };
  const navigate = useNavigate();
  const openOption = () => {
    setShowOption(true);
  };
  const closeOption = () => {
    setSelectUser({} as IAdminUser);
    setShowOption(false);
  };

  const getPlans = async () => {
    let body = {
      where: {
        activated: 1,
      },
    };
    try {
      const plans: any = await trpc.plans.findManyPlans.query(body);
      setPlans(plans);
    } catch (error) {
      console.log(error);
    }
  };
  const giveSuscription = (user: IAdminUser) => {
    setSelectUser(user);
    setOptionTitle("Seleccione el plan");
    openOption();
  };
  const MessageComplete = useSSE("remove-users:completed", {
    queue: "remove-users",
    jobId: null,
  });
  const MessageFail = useSSE("remove-users:failed", {
    queue: "remove-users",
    jobId: null,
  });
  const changeBlockUser = async () => {
    try {
      let body = {
        userId: selectedUser.id,
      };
      if (blocking) {
        await trpc.users.blockUser.mutate(body);
      } else {
        await trpc.users.unblockUser.mutate(body);
      }
      closeBlockModal();
      filterUsers(filters);
    } catch (error) {
      console.log(error);
    }
  };


  const startFilter = (key: string, value: string | number) => {
    let tempFilters: any = filters;
    if (key !== "page") {
      tempFilters.page = 0;
    }
    tempFilters[key] = value;
    filterUsers(tempFilters);
    setFilters(tempFilters);
  };
  const transformUserData = async () => {
    const fetchUsers = await exportUsers(filters);

    if (!fetchUsers || fetchUsers.length < 0) {
      throw new Error('Error loading tempUsers');
    }

    const tempUsers = fetchUsers.map((user) => ({
      Usuario: user.username,
      Correo: user.email,
      "Fecha de Registro": user.registered_on.toLocaleDateString(),
      Teléfono: user.phone,
    }))

    return tempUsers;
  };
  const filterUsers = async (filt: IAdminFilter) => {
    setLoader(true);
    setTotalLoader(true);
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
            registered_on: "desc",
          },
        };
        let body2: any = {
          where: {
            email: {
              startsWith: filt.search,
            },
          },
          select: {
            id: true,
          },
        };
        const tempUsers = await trpc.users.findManyUsers.query(body);
        const transformedUsers: IAdminUser[] = tempUsers.map((user) => ({
          email: user.email,
          username: user.username,
          active: user.active,
          id: user.id,
          registered_on: user.registered_on,
          blocked: user.blocked,
          phone: user.phone ?? "",
          password: user.password,
          role: user.role_id ?? 4,
        }))
        setLoader(false);
        setUsers(transformedUsers);
        const totalUsersResponse = await trpc.users.findManyUsers.query(body2);
        setTotalUsers(totalUsersResponse.length);
        setTotalLoader(false);
      } else {
        let body: any = {
          take: filt.limit,
          skip: filt.page * filt.limit,
          where: {
            email: {
              startsWith: filt.search,
            },
          },
          orderBy: {
            registered_on: "desc",
          },
        };
        let body2: any = {
          where: {
            email: {
              startsWith: filt.search,
            },
          },
          select: {
            id: true,
          },
        };
        let tempUsers: any = [];
        let totalUsersResponse = [];
        if (filt.active === 1) {
          tempUsers = await trpc.users.getActiveUsers.query(body);
          totalUsersResponse = await trpc.users.getActiveUsers.query(body2);
        } else {
          tempUsers = await trpc.users.getInactiveUsers.query(body);
          totalUsersResponse = await trpc.users.getInactiveUsers.query(body2);
        }
        setUsers(tempUsers);
        setTotalUsers(totalUsersResponse.length);
        setTotalLoader(false);
        setLoader(false);
      }
    } catch (error) {
      console.log(error);
    }
  };
  useEffect(() => {
    if (MessageComplete.jobId !== null || MessageFail.jobId !== null) {
      filterUsers(filters);
    }
  }, [MessageComplete, MessageFail, filters]);

  useEffect(() => {
    getPlans();
    filterUsers(filters);
  }, [filters]);
  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") {
      navigate("/");
    }
  }, [currentUser, navigate]);

  const handleEditUser = (user: IAdminUser) => {
    setSelectedUser(user);
    setShowEdit(true);
  }

  const handleCloseEditUser = () => {
    setShowEdit(false);
    setSelectUser({} as IAdminUser);
  }

  const handleOpenHistory = async (user: IAdminUser) => {
    setSelectUser(user);
    setShowHistory(true);
  }

  const handleCloseHistory = () => {
    setShowHistory(false);
    setSelectUser({} as IAdminUser);
  }

  const handleOpenAddGB = async (user: IAdminUser) => {
    setSelectUser(user);
    setShowAddGB(true);
  }

  const handleCloseAddGB = () => {
    setShowAddGB(false);
    setSelectUser({} as IAdminUser);
  }
  const handleDeleteUser = async (user: IAdminUser) => {
    setSelectUser(user);
    setShowDeleteUser(true);
  }

  const handleCloseDeleteUser = () => {
    setShowDeleteUser(false);
    setSelectUser({} as IAdminUser);
  }


  const signInAsUser = async (user: any) => {
    setLoader(true);
    const [loginAsUser, errorLogin] = await of(trpc.auth.login.query({
      username: user.email,
      password: user.password,
      isAdmin: true
    }));

    if (!loginAsUser && errorLogin) {
      setErrorMessage(errorLogin.message);
      setShowError(true);
      setLoader(false);
      return;
    }

    const adminToken = localStorage.getItem("token");
    const adminRefreshToken = localStorage.getItem("refreshToken");
    localStorage.setItem("isAdminAccess", JSON.stringify({ adminToken, adminRefreshToken }));

    handleLogin(loginAsUser!.token, loginAsUser!.refreshToken);
    navigate("/");
    setLoader(false);
  }

  const closeErrorModal = () => {
    setShowError(false);
  };

  /**
   * Function that helps determine whether a dropdown should be up or down the Action button.
   * @param {number} index Actions dropdown that will be shown
   * @returns {boolean} Tells if dropdown should be displayed up or down
   */
  const positioningAction = (index: number): void => {
    const pageLastPixel = document.body.scrollHeight;
    const element = document.getElementById(`dropdown-content-${index}`);
    if (element) {
      const rect = element.getBoundingClientRect();
      const elementLastPixel = rect.bottom;

      if (elementLastPixel >= pageLastPixel) {
        element.classList.add("dropdown-up");
      }
    }
  }

  return (
    <div className="admin-contain">
      <div className="header">
        <h1>Usuarios</h1>
        <button className="btn-addUsers" onClick={() => setShowModal(true)}>
          Añadir Usuarios
        </button>
        <CsvDownloader
          className="btn-addUsers"
          filename="lista_de_usuarios"
          extension=".csv"
          separator=";"
          wrapColumnChar=""
          datas={transformUserData()}
          text="Exportar Clientes"
        />
        <EditUserModal
          showModal={showEdit}
          onHideModal={handleCloseEditUser}
          editingUser={selectedUser}
        />
      </div>
      <div className="filter-contain">
        <div className="left-contain">
          <div className="select-input">
            <select onChange={(e) => startFilter("active", +e.target.value)}>
              <option value={2}>Todos</option>
              <option value={1}>Activos</option>
              <option value={0}>Inactivos</option>
            </select>
          </div>
          <div className="select-input">
            <select
              defaultValue={filters.limit}
              onChange={(e) => startFilter("limit", +e.target.value)}
            >
              <option value={""} disabled>
                Numero de datos
              </option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
        <div className="search-input">
          <input
            placeholder="Buscar por email"
            onChange={(e: any) => {
              startFilter("search", e.target.value);
            }}
          />
          <FontAwesomeIcon icon={faSearch} />
        </div>
      </div>
      <div className="admin-table">
        <div className="table-contain">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Registro</th>
                {filters.active !== 2 && <th>Suscripción</th>}

                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!loader
                ? users.map((user: IAdminUser, index: number) => {
                  return (
                    <tr key={"admin_users_" + index}>
                      <td className="">{user.username}</td>
                      <td>{user.email}</td>
                      <td>{user.phone}</td>
                      <td>{user.registered_on.toLocaleDateString()}</td>
                      {filters.active !== 2 && (
                        <td>
                          {filters.active === 1 ? "Activa" : "No activa"}
                        </td>
                      )}
                      <td className="wrap-td">
                        <div className="dropdown">
                          <button className="dropbtn" onMouseEnter={() => { positioningAction(index) }}>Acciones</button>
                          <div className="dropdown-content" id={`dropdown-content-${index}`}>
                            <button onClick={() => handleEditUser(user)}>Editar</button>
                            <button onClick={() => signInAsUser(user)} disabled={user.role === USER_ROLES.ADMIN}>Acceder</button>
                            <button onClick={() => giveSuscription(user)}>Activar</button>
                            <button onClick={() => handleDeleteUser(user)} disabled={user.role === USER_ROLES.ADMIN}>Eliminar</button>
                            <button onClick={() => handleOpenHistory(user)}>Historial</button>
                            <button onClick={() => handleOpenAddGB(user)}>Agregar GB</button>
                            <button className="icon-button" onClick={() =>
                              openBlockModal(
                                user,
                                `Estas por ${user.blocked ? 'desbloquear' : 'bloquear'} al usuario: ${user.username}`,
                                !user.blocked
                              )
                            }>
                              {user.blocked ? (
                                <FaLock className='lock' />
                              ) : (
                                <FaLockOpen className='unlock' />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
                : ARRAY_10.map((val: string, index: number) => {
                  return filters.active !== 2 ? (
                    <tr key={"array_10" + index} className="tr-load">
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                    </tr>
                  ) : (
                    <tr key={"array_10" + index} className="tr-load">
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                    </tr>
                  );
                })}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={5}>
                  <Pagination
                    totalLoader={totalLoader}
                    totalData={totalUsers}
                    title="usuarios"
                    startFilter={startFilter}
                    currentPage={filters.page}
                    limit={filters.limit}
                  />
                </th>

              </tr>
            </tfoot>
          </table>
        </div>

      </div>
      <AddUsersModal showModal={showModal} onHideModal={closeModalAdd} />
      <DeleteUserModal
        filterUsers={filterUsers}
        filters={filters}
        show={showDeleteModal}
        onHide={handleDeleteModal}
      />
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
        message=""
        userId={selectUser.id}
        plans={plans}
      />
      <ErrorModal show={showError} onHide={closeErrorModal} message={errorMessage} />
      <HistoryModal
        show={showHistory}
        onHide={handleCloseHistory}
        user={selectUser}
      />
      <AddExtraStorageModal
        showModal={showAddGB}
        onHideModal={handleCloseAddGB}
        userId={selectUser.id}
      />
      <DeleteUOneUserModal 
        show={showDeleteUser}
        onHide={handleCloseDeleteUser}
        user={selectUser}
      />
    </div>
  );
}
export default Admin;
