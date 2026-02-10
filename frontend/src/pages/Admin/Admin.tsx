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
import {
  Search,
  Plus,
  Download,
  Pencil,
  LogIn,
  MoreVertical,
  Lock,
  LockOpen,
  Users,
  Filter,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import Pagination from "../../components/Pagination/Pagination";
import { ARRAY_10 } from "../../utils/Constants";
import CsvDownloader from "react-csv-downloader";
import { exportUsers } from "./fuctions";
import { of } from "await-of";
import { AdminDrawer } from "../../components/AdminDrawer/AdminDrawer";
import {
  getAccessToken,
  getRefreshToken,
  setAdminAccessBackup,
} from "../../utils/authStorage";
import { useSafeSSE } from "../../utils/sse";
import { formatDateShort, formatInt } from "../../utils/format";

export interface IAdminFilter {
  page: number;
  total: number;
  search: string;
  active: number;
  limit: number;
}

interface IExportUserRow {
  username: string;
  email: string;
  registered_on: Date | string;
  phone?: string | null;
}

const getInitialPageLimit = () => {
  if (typeof window === "undefined") return 50;
  return window.innerWidth <= 900 ? 25 : 50;
};

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
    total: 0,
    search: "",
    active: 2,
    limit: getInitialPageLimit(),
  });
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showAddGB, setShowAddGB] = useState<boolean>(false);
  const [showDeleteUser, setShowDeleteUser] = useState<boolean>(false);
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const [drawerUser, setDrawerUser] = useState<IAdminUser | null>(null);
  const [loadError, setLoadError] = useState<string>("");

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
    } catch {
    }
  };

  const giveSuscription = (user: IAdminUser) => {
    setSelectUser(user);
    setOptionTitle("Seleccione el plan");
    openOption();
  };

  const MessageComplete = useSafeSSE("remove-users:completed", { queue: "remove-users", jobId: null });
  const MessageFail = useSafeSSE("remove-users:failed", { queue: "remove-users", jobId: null });

  const changeBlockUser = async () => {
    try {
      if (blocking) {
        await trpc.users.blockUser.mutate({ userId: selectedUser.id });
      } else {
        await trpc.users.unblockUser.mutate({ userId: selectedUser.id });
      }
      closeBlockModal();
      filterUsers(filters);
    } catch {
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
    return fetchUsers.map((user: IExportUserRow) => ({
      Usuario: user.username,
      Correo: user.email,
      "Fecha de Registro": (user.registered_on instanceof Date
        ? user.registered_on
        : new Date(user.registered_on)
      ).toLocaleDateString(),
      Teléfono: user.phone ?? "",
    }));
  };

  const filterUsers = async (filt: IAdminFilter) => {
    setLoadError("");
    setLoader(true);
    setTotalLoader(true);
    try {
      const baseWhere = { email: { startsWith: filt.search } };
      const baseSelect = {
        id: true,
        username: true,
        email: true,
        phone: true,
        active: true,
        registered_on: true,
        role_id: true,
      };
      const baseBody = {
        take: filt.limit,
        skip: filt.page * filt.limit,
        where: baseWhere,
        orderBy: { registered_on: "desc" as const },
        select: baseSelect,
      };
      const countBody = { where: baseWhere, select: { id: true } };

      if (filt.active === 2) {
        const tempUsers = await trpc.users.findManyUsers.query(baseBody);
        const transformedUsers: IAdminUser[] = tempUsers.map((u: any) => ({
          email: u.email,
          username: u.username,
          active: u.active,
          id: u.id,
          registered_on: u.registered_on,
          blocked: Boolean(u.blocked),
          phone: u.phone ?? "",
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
    } catch {
      setUsers([]);
      setTotalUsers(0);
      setLoadError("No se pudieron cargar los usuarios. Revisa la conexión e intenta nuevamente.");
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
    const [loginAsUser, errorLogin] = await of(
      trpc.auth.impersonateUser.mutate({
        userId: user.id,
      })
    );
    if (!loginAsUser && errorLogin) {
      setErrorMessage(errorLogin.message);
      setShowError(true);
      setLoader(false);
      return;
    }
    const adminToken = getAccessToken();
    const adminRefreshToken = getRefreshToken();
    if (adminToken && adminRefreshToken) {
      setAdminAccessBackup({ adminToken, adminRefreshToken });
    }
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
      if (rect.bottom >= window.innerHeight - 12) element.classList.add("dropdown-up");
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
  const activeFilterLabel = filters.active === 1 ? "Activos" : filters.active === 0 ? "Inactivos" : "Todos";
  const rangeStart = totalUsers === 0 ? 0 : filters.page * filters.limit + 1;
  const rangeEnd = Math.min(filters.page * filters.limit + users.length, totalUsers);
  const retryUsersLoad = () => {
    filterUsers(filters);
    trpc.users.countUsers.query().then(setTotalRegistered).catch(() => setTotalRegistered(null));
  };

  return (
    <div className="admin-theme">
      <div className="admin-contain">
        <section className="admin-top-bar">
          <div className="admin-top-bar__intro">
            <div className="header__title-row">
              <h1 className="admin-title">Usuarios</h1>
              {totalRegistered !== null && (
                <span className="header__total-registered">
                  Registrados: {formatInt(totalRegistered)}
                </span>
              )}
            </div>
            <p className="admin-subtitle">Controla accesos, soporte y acciones críticas desde un solo panel.</p>
            <div className="admin-insights">
              <span className="insight-pill">
                <Users size={14} />
                {formatInt(totalUsers)} resultados
              </span>
              <span className="insight-pill">
                <Filter size={14} />
                {activeFilterLabel}
              </span>
              <span className="insight-pill">
                Mostrando {formatInt(rangeStart)}-{formatInt(rangeEnd)}
              </span>
            </div>
          </div>
          <div className="filter-contain">
            <div className="left-contain">
              <div className="select-input">
                <label htmlFor="admin-status-filter">Estado</label>
                <select
                  id="admin-status-filter"
                  value={filters.active}
                  onChange={(e) => startFilter("active", +e.target.value)}
                >
                  <option value={2}>Todos</option>
                  <option value={1}>Activos</option>
                  <option value={0}>Inactivos</option>
                </select>
              </div>
              <div className="select-input">
                <label htmlFor="admin-limit-filter">Por página</label>
                <select
                  id="admin-limit-filter"
                  value={filters.limit}
                  onChange={(e) => startFilter("limit", +e.target.value)}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
              <div className="search-input">
                <label htmlFor="admin-search-filter">Buscar</label>
                <Search className="search-input__icon" size={18} />
                <input
                  id="admin-search-filter"
                  placeholder="Buscar por email"
                  value={filters.search}
                  onChange={(e) => startFilter("search", e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="header__actions">
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
              <span className="btn-icon btn-secondary">
                <Download size={18} /> Exportar
              </span>
            </CsvDownloader>
          </div>
        </section>

        {loadError && !loader && (
          <section className="admin-error-strip" role="alert">
            <AlertTriangle size={16} />
            <p>{loadError}</p>
            <button type="button" className="btn-icon btn-secondary" onClick={retryUsersLoad}>
              <RefreshCw size={16} />
              Reintentar
            </button>
          </section>
        )}

        <section className="admin-table-panel">
          <div className="table-contain">
            <table className="admin-table">
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
                {!loader && users.length === 0 && (
                  <tr className="admin-empty-row">
                    <td colSpan={colCount}>
                      {loadError ? (
                        <div className="admin-empty-state admin-empty-state--error">
                          <h3>No se pudieron mostrar los usuarios</h3>
                          <p>{loadError}</p>
                          <button type="button" className="btn-icon btn-secondary" onClick={retryUsersLoad}>
                            <RefreshCw size={16} />
                            Reintentar
                          </button>
                        </div>
                      ) : (
                        <div className="admin-empty-state">
                          <h3>No hay usuarios para este filtro</h3>
                          <p>Prueba cambiar estado o búsqueda para ver resultados.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                {!loader
                  ? users.map((user, index) => (
                      <tr key={`admin_users_${user.id}`}>
                        <td className="admin-cell-name">
                          <div className="admin-user-inline">
                            <span className="admin-user-inline__avatar">
                              {(user.username || user.email || "?").charAt(0).toUpperCase()}
                            </span>
                            <div className="admin-user-inline__copy">
                              <span className="admin-user-inline__name" title={user.username}>
                                {user.username || "Sin nombre"}
                              </span>
                              <span className="admin-user-inline__meta">ID #{user.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="admin-cell-email">
                          <div className="admin-cell-stack">
                            <span className="admin-cell-value" title={user.email}>{user.email}</span>
                            <span className={`badge badge--tiny ${user.blocked ? "badge--danger" : "badge--success"}`}>
                              {user.blocked ? "Bloqueado" : "Activo"}
                            </span>
                          </div>
                        </td>
                        <td className="admin-cell-phone" title={user.phone || "Sin teléfono"}>
                          {user.phone || "—"}
                        </td>
                        <td>
                          <span className="date-pill">{formatDateShort(user.registered_on)}</span>
                        </td>
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
                              aria-label="Editar usuario"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="btn-cell"
                              onClick={() => signInAsUser(user)}
                              disabled={user.role === USER_ROLES.ADMIN}
                              title="Acceder"
                              aria-label="Acceder como usuario"
                            >
                              <LogIn size={16} />
                            </button>
                            <div
                              className={`dropdown ${openDropdownIndex === index ? "open" : ""}`}
                              data-dropdown-index={index}
                            >
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
                                aria-label="Más acciones"
                              >
                                <MoreVertical size={16} />
                              </button>
                              <div className="dropdown-content" id={`dropdown-content-${index}`}>
                                <button type="button" onClick={() => { setOpenDropdownIndex(null); giveSuscription(user); }}>Activar plan</button>
                                <button type="button" onClick={() => { setOpenDropdownIndex(null); handleOpenHistory(user); }}>Historial</button>
                                <button type="button" onClick={() => { setOpenDropdownIndex(null); handleOpenAddGB(user); }}>Agregar GB</button>
                                <button
                                  type="button"
                                  className="dropdown-action--danger"
                                  onClick={() => { setOpenDropdownIndex(null); handleDeleteUser(user); }}
                                  disabled={user.role === USER_ROLES.ADMIN}
                                >
                                  Eliminar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownIndex(null);
                                    openBlockModal(user, `¿${user.blocked ? 'Desbloquear' : 'Bloquear'} a ${user.username}?`, !user.blocked);
                                  }}
                                >
                                  {user.blocked ? <><LockOpen size={14} /> Desbloquear</> : <><Lock size={14} /> Bloquear</>}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  : ARRAY_10.map((_, index) => (
                      <tr key={`load_${index}`} className="tr-load">
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
        </section>

        <section className="admin-mobile-list">
          {!loader
            ? users.length === 0
              ? (
                <div className="admin-mobile-empty">
                  {loadError ? (
                    <>
                      <h3>No se pudieron mostrar los usuarios</h3>
                      <p>{loadError}</p>
                      <button type="button" className="btn-icon btn-secondary" onClick={retryUsersLoad}>
                        <RefreshCw size={16} />
                        Reintentar
                      </button>
                    </>
                  ) : (
                    <>
                      <h3>No hay usuarios para este filtro</h3>
                      <p>Prueba cambiar estado o búsqueda para ver resultados.</p>
                    </>
                  )}
                </div>
                )
              : users.map((user, index) => (
                  <button
                    key={`mobile_${user.id}`}
                    className="admin-mobile-card"
                    onClick={() => openDrawer(user)}
                    type="button"
                  >
                    <div className="admin-mobile-card__head">
                      <div className="admin-mobile-card__identity">
                        <div className="admin-mobile-card__avatar">
                          {(user.username || user.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="admin-mobile-card__copy">
                          <p className="admin-mobile-card__name">{user.username || "Sin nombre"}</p>
                          <p className="admin-mobile-card__email">{user.email}</p>
                        </div>
                      </div>
                      <span className={`admin-mobile-status ${user.blocked ? "is-blocked" : "is-active"}`}>
                        {user.blocked ? "Bloqueado" : "Activo"}
                      </span>
                      <span className="admin-mobile-card__menu" aria-hidden>
                        <MoreVertical size={20} />
                      </span>
                    </div>
                    <div className="admin-mobile-card__foot">
                      <span>{user.phone || "Sin teléfono"}</span>
                      <span>{formatDateShort(user.registered_on)}</span>
                    </div>
                  </button>
                ))
            : ARRAY_10.map((_, i) => (
                <div key={`skeleton_${i}`} className="admin-mobile-card admin-mobile-card--skeleton">
                  <div className="admin-mobile-card__head">
                    <div className="admin-mobile-card__identity">
                      <div className="admin-mobile-card__avatar" />
                      <div className="admin-mobile-card__copy">
                        <p className="admin-mobile-card__name">—</p>
                        <p className="admin-mobile-card__email">—</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
        </section>

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
      <EditUserModal
        showModal={showEdit}
        onHideModal={handleCloseEditUser}
        editingUser={selectedUser}
        onSaved={() => filterUsers(filters)}
      />
      <HistoryModal show={showHistory} onHide={handleCloseHistory} user={selectUser} />
      <AddExtraStorageModal showModal={showAddGB} onHideModal={handleCloseAddGB} userId={selectUser.id} />
      <DeleteUOneUserModal
        show={showDeleteUser}
        onHide={handleCloseDeleteUser}
        user={selectUser}
        onDeleted={() => filterUsers(filters)}
      />
    </div>
  );
}

export default Admin;
