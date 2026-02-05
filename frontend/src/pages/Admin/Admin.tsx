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
} from '../../components/Modals';
import { useNavigate } from "react-router-dom";
import { Search, Plus, Download, Pencil, LogIn, MoreVertical } from "lucide-react";
import Pagination from "../../components/Pagination/Pagination";
import { ARRAY_10 } from "../../utils/Constants";
import CsvDownloader from "react-csv-downloader";
import { exportUsers } from "./fuctions";
import { FaLockOpen } from "react-icons/fa";
import { FaLock } from "react-icons/fa";
import { useSSE } from "react-hooks-sse";
import { of } from "await-of";
import { AdminDrawer } from "../../components/AdminDrawer/AdminDrawer";

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
  const [totalRegistered, setTotalRegistered] = useState<number | null>(null);
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
  const [filters, setFilters] = useState<IAdminFilter>({
    page: 0,
    search: "",
    active: 2,
    limit: 100,
  });
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showAddGB, setShowAddGB] = useState<boolean>(false);
  const [showDeleteUser, setShowDeleteUser] = useState<boolean>(false);
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const [drawerUser, setDrawerUser] = useState<IAdminUser | null>(null);

  const closeModalAdd = () => setShowModal(false);
  const handleDeleteModal = () => setShowDeleteModal(!showDeleteModal);
  const closeBlockModal = () => setShowBlockModal(false);
  const openBlockModal = (user: IAdminUser, message: string, block: boolean) => {
    setBlocking(block);
    setBlockModalMSG(message);
    setShowBlockModal(true);
    setSelectedUser(user);
  };
  const navigate = useNavigate();
  const openOption = () => setShowOption(true);
  const closeOption = () => {
    setSelectUser({} as IAdminUser);
    setShowOption(false);
  };

  const getPlans = async () => {
    try {
      const plans: any = await trpc.plans.findManyPlans.query({ where: { activated: 1 } });
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

  const MessageComplete = useSSE("remove-users:completed", { queue: "remove-users", jobId: null });
  const MessageFail = useSSE("remove-users:failed", { queue: "remove-users", jobId: null });

  const changeBlockUser = async () => {
    try {
      if (blocking) {
        await trpc.users.blockUser.mutate({ userId: selectedUser.id });
      } else {
        await trpc.users.unblockUser.mutate({ userId: selectedUser.id });
      }
      closeBlockModal();
      filterUsers(filters);
    } catch (error) {
      console.log(error);
    }
  };

  const startFilter = (key: string, value: string | number) => {
    const tempFilters = { ...filters };
    if (key !== "page") tempFilters.page = 0;
    (tempFilters as any)[key] = value;
    filterUsers(tempFilters);
    setFilters(tempFilters);
  };

  const transformUserData = async () => {
    const fetchUsers = await exportUsers(filters);
    if (!fetchUsers || fetchUsers.length < 0) throw new Error('Error loading tempUsers');
    return fetchUsers.map((user) => ({
      Usuario: user.username,
      Correo: user.email,
      "Fecha de Registro": user.registered_on.toLocaleDateString(),
      Teléfono: user.phone,
    }));
  };

  const filterUsers = async (filt: IAdminFilter) => {
    setLoader(true);
    setTotalLoader(true);
    try {
      const baseWhere = { email: { startsWith: filt.search } };
      const baseBody = { take: filt.limit, skip: filt.page * filt.limit, where: baseWhere, orderBy: { registered_on: "desc" as const } };
      const countBody = { where: baseWhere, select: { id: true } };

      if (filt.active === 2) {
        const tempUsers = await trpc.users.findManyUsers.query(baseBody);
        const transformedUsers: IAdminUser[] = tempUsers.map((u: any) => ({
          email: u.email,
          username: u.username,
          active: u.active,
          id: u.id,
          registered_on: u.registered_on,
          blocked: u.blocked,
          phone: u.phone ?? "",
          password: u.password,
          role: u.role_id ?? 4,
        }));
        setUsers(transformedUsers);
        const totalUsersResponse = await trpc.users.findManyUsers.query(countBody);
        setTotalUsers(totalUsersResponse.length);
      } else {
        const query = filt.active === 1 ? trpc.users.getActiveUsers : trpc.users.getInactiveUsers;
        const tempUsers = await query.query(baseBody);
        const totalUsersResponse = await query.query(countBody);
        setUsers(tempUsers);
        setTotalUsers(totalUsersResponse.length);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoader(false);
      setTotalLoader(false);
    }
  };

  useEffect(() => {
    if (MessageComplete.jobId !== null || MessageFail.jobId !== null) filterUsers(filters);
  }, [MessageComplete, MessageFail, filters]);

  useEffect(() => {
    getPlans();
    filterUsers(filters);
  }, []);

  useEffect(() => {
    trpc.users.countUsers.query().then(setTotalRegistered).catch(() => setTotalRegistered(null));
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") navigate("/");
  }, [currentUser, navigate]);

  const handleEditUser = (user: IAdminUser) => {
    setSelectedUser(user);
    setShowEdit(true);
  };
  const handleCloseEditUser = () => {
    setShowEdit(false);
    setSelectUser({} as IAdminUser);
  };
  const handleOpenHistory = (user: IAdminUser) => {
    setSelectUser(user);
    setShowHistory(true);
  };
  const handleCloseHistory = () => {
    setShowHistory(false);
    setSelectUser({} as IAdminUser);
  };
  const handleOpenAddGB = (user: IAdminUser) => {
    setSelectedUser(user);
    setShowAddGB(true);
  };
  const handleCloseAddGB = () => {
    setShowAddGB(false);
    setSelectUser({} as IAdminUser);
  };
  const handleDeleteUser = (user: IAdminUser) => {
    setSelectUser(user);
    setShowDeleteUser(true);
  };
  const handleCloseDeleteUser = () => {
    setShowDeleteUser(false);
    setSelectUser({} as IAdminUser);
  };

  const signInAsUser = async (user: IAdminUser) => {
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
  };

  const closeErrorModal = () => setShowError(false);

  const toggleDropdown = (index: number) => {
    setOpenDropdownIndex((prev) => (prev === index ? null : index));
  };

  const positioningAction = (index: number) => {
    const element = document.getElementById(`dropdown-content-${index}`);
    if (element) {
      const rect = element.getBoundingClientRect();
      if (rect.bottom >= document.body.scrollHeight) element.classList.add("dropdown-up");
      else element.classList.remove("dropdown-up");
    }
  };

  useEffect(() => {
    if (openDropdownIndex === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-dropdown-index="${openDropdownIndex}"]`)) setOpenDropdownIndex(null);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openDropdownIndex]);

  const openDrawer = (user: IAdminUser) => {
    setDrawerUser(user);
    setSelectUser(user);
  };
  const closeDrawer = () => setDrawerUser(null);

  const drawerActions = drawerUser
    ? [
        { id: "edit", label: "Editar", onClick: () => handleEditUser(drawerUser!), variant: "secondary" as const },
        { id: "access", label: "Acceder", onClick: () => signInAsUser(drawerUser!), disabled: drawerUser.role === USER_ROLES.ADMIN, variant: "primary" as const },
        { id: "activate", label: "Activar plan", onClick: () => { giveSuscription(drawerUser!); closeDrawer(); }, variant: "secondary" as const },
        { id: "history", label: "Historial", onClick: () => { handleOpenHistory(drawerUser!); closeDrawer(); }, variant: "secondary" as const },
        { id: "addgb", label: "Agregar GB", onClick: () => { handleOpenAddGB(drawerUser!); closeDrawer(); }, variant: "secondary" as const },
        { id: "block", label: drawerUser.blocked ? "Desbloquear" : "Bloquear", onClick: () => openBlockModal(drawerUser!, `¿${drawerUser.blocked ? 'Desbloquear' : 'Bloquear'} a ${drawerUser.username}?`, !drawerUser.blocked), variant: "secondary" as const },
        { id: "delete", label: "Eliminar", onClick: () => handleDeleteUser(drawerUser!), disabled: drawerUser.role === USER_ROLES.ADMIN, variant: "danger" as const },
      ]
    : [];

  const colCount = filters.active !== 2 ? 6 : 5;

  return (
    <div className="admin-theme w-full max-w-[100vw] overflow-x-hidden">
      <div className="admin-contain">
        <div className="admin-top-bar flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
          <div className="header__title-row">
            <h1>Usuarios</h1>
            {totalRegistered !== null && (
              <span className="header__total-registered">
                Registrados: {totalRegistered.toLocaleString()}
              </span>
            )}
          </div>
          <div className="filter-contain flex flex-col md:flex-row md:items-center md:flex-1 md:justify-center md:max-w-2xl md:gap-3">
            <div className="left-contain flex flex-wrap gap-2 md:flex-nowrap md:gap-3">
              <div className="select-input">
                <select value={filters.active} onChange={(e) => startFilter("active", +e.target.value)}>
                  <option value={2}>Todos</option>
                  <option value={1}>Activos</option>
                  <option value={0}>Inactivos</option>
                </select>
              </div>
              <div className="select-input">
                <select value={filters.limit} onChange={(e) => startFilter("limit", +e.target.value)}>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>
              <div className="search-input flex-1 min-w-0">
                <Search className="search-input__icon" size={18} />
                <input
                  placeholder="Buscar por email"
                  value={filters.search}
                  onChange={(e) => startFilter("search", e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="header__actions flex flex-wrap gap-2 shrink-0">
            <button type="button" className="btn-icon btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={18} /> Añadir
            </button>
            <CsvDownloader
              filename="lista_de_usuarios"
              extension=".csv"
              separator=";"
              wrapColumnChar=""
              datas={transformUserData()}
              text=""
            >
              <button type="button" className="btn-icon">
                <Download size={18} /> Exportar
              </button>
            </CsvDownloader>
          </div>
        </div>

        {/* Tabla desktop: visible solo en md+ */}
        <div className="admin-table hidden md:block">
          <div className="table-contain">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="bg-slate-900 text-slate-400 p-4">Nombre</th>
                  <th className="bg-slate-900 text-slate-400 p-4">Email</th>
                  <th className="bg-slate-900 text-slate-400 p-4">Teléfono</th>
                  <th className="bg-slate-900 text-slate-400 p-4">Registro</th>
                  {filters.active !== 2 && <th className="bg-slate-900 text-slate-400 p-4">Suscripción</th>}
                  <th className="bg-slate-900 text-slate-400 p-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {!loader
                  ? users.map((user, index) => (
                      <tr key={`admin_users_${index}`}>
                        <td className="max-w-[120px] truncate" title={user.username}>{user.username}</td>
                        <td className="max-w-[180px] truncate" title={user.email}>{user.email}</td>
                        <td className="max-w-[100px] truncate" title={user.phone}>{user.phone}</td>
                        <td>{user.registered_on.toLocaleDateString()}</td>
                        {filters.active !== 2 && (
                          <td>
                            <span className={`badge ${filters.active === 1 ? "badge--success" : "badge--neutral"}`}>
                              {filters.active === 1 ? "Activa" : "No activa"}
                            </span>
                          </td>
                        )}
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="btn-cell"
                              onClick={() => handleEditUser(user)}
                              title="Editar"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="btn-cell"
                              onClick={() => signInAsUser(user)}
                              disabled={user.role === USER_ROLES.ADMIN}
                              title="Acceder"
                            >
                              <LogIn size={16} />
                            </button>
                            <div className="dropdown" data-dropdown-index={index}>
                              <button
                                type="button"
                                className="btn-cell"
                                onMouseEnter={() => positioningAction(index)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  positioningAction(index);
                                  toggleDropdown(index);
                                }}
                                title="Más acciones"
                              >
                                <MoreVertical size={16} />
                              </button>
                              <div className="dropdown-content" id={`dropdown-content-${index}`}>
                                <button type="button" onClick={() => { setOpenDropdownIndex(null); giveSuscription(user); }}>Activar plan</button>
                                <button type="button" onClick={() => { setOpenDropdownIndex(null); handleOpenHistory(user); }}>Historial</button>
                                <button type="button" onClick={() => { setOpenDropdownIndex(null); handleOpenAddGB(user); }}>Agregar GB</button>
                                <button type="button" onClick={() => { setOpenDropdownIndex(null); handleDeleteUser(user); }} disabled={user.role === USER_ROLES.ADMIN}>Eliminar</button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownIndex(null);
                                    openBlockModal(user, `¿${user.blocked ? 'Desbloquear' : 'Bloquear'} a ${user.username}?`, !user.blocked);
                                  }}
                                >
                                  {user.blocked ? <><FaLock /> Bloquear</> : <><FaLockOpen /> Desbloquear</>}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  : ARRAY_10.map((_, index) => (
                      <tr key={`load_${index}`} className="tr-load border-b border-slate-800 hover:bg-slate-900">
                        <td /><td /><td /><td />
                        {filters.active !== 2 && <td />}
                        <td />
                      </tr>
                    ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={colCount}>
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

        {/* Lista compacta móvil: visible solo en móvil */}
        <div className="admin-list-mobile block md:hidden">
          {!loader
            ? users.map((user, index) => (
                <div
                  key={`mobile_${index}`}
                  className="admin-list-row"
                  onClick={() => openDrawer(user)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && openDrawer(user)}
                >
                  <div className="admin-list-row__left">
                    <div className="admin-list-row__avatar">
                      {(user.username || user.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="admin-list-row__info">
                      <span className="admin-list-row__name">{user.username}</span>
                      <span className="admin-list-row__email">{user.email}</span>
                    </div>
                  </div>
                  <div className="admin-list-row__right">
                    <span className={`badge ${user.blocked ? "badge--danger" : "badge--success"}`}>
                      {user.blocked ? "Bloqueado" : "Activo"}
                    </span>
                    <button
                      type="button"
                      className="admin-list-row__menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDrawer(user);
                      }}
                      aria-label="Abrir acciones"
                    >
                      <MoreVertical size={20} />
                    </button>
                  </div>
                </div>
              ))
            : ARRAY_10.map((_, i) => (
                <div key={`skeleton_${i}`} className="admin-list-row">
                  <div className="admin-list-row__left">
                    <div className="admin-list-row__avatar" style={{ opacity: 0.5 }}>?</div>
                    <div className="admin-list-row__info">
                      <span className="admin-list-row__name">—</span>
                      <span className="admin-list-row__email">—</span>
                    </div>
                  </div>
                </div>
              ))}
        </div>

        <div className="admin-pagination-mobile">
          <Pagination
            totalLoader={totalLoader}
            totalData={totalUsers}
            title="usuarios"
            startFilter={startFilter}
            currentPage={filters.page}
            limit={filters.limit}
          />
        </div>
      </div>

      <AdminDrawer
        open={drawerUser !== null}
        onClose={closeDrawer}
        title="Usuario"
        user={drawerUser}
        actions={drawerActions}
      />

      <AddUsersModal showModal={showModal} onHideModal={closeModalAdd} />
      <DeleteUserModal filterUsers={filterUsers} filters={filters} show={showDeleteModal} onHide={handleDeleteModal} />
      <ConditionModal title="Bloquear Usuario" message={blockModalMSG} show={showBlockModal} onHide={closeBlockModal} action={changeBlockUser} />
      <OptionModal show={showOption} onHide={closeOption} title={optionTitle} message="" userId={selectUser.id} plans={plans} />
      <ErrorModal show={showError} onHide={closeErrorModal} message={errorMessage} />
      <EditUserModal showModal={showEdit} onHideModal={handleCloseEditUser} editingUser={selectedUser} />
      <HistoryModal show={showHistory} onHide={handleCloseHistory} user={selectUser} />
      <AddExtraStorageModal showModal={showAddGB} onHideModal={handleCloseAddGB} userId={selectUser.id} />
      <DeleteUOneUserModal show={showDeleteUser} onHide={handleCloseDeleteUser} user={selectUser} />
    </div>
  );
}

export default Admin;
