import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddPlanModal from "../../../components/Modals/AddPlanModal/AddPlanModal";
import { IPlans } from "interfaces/Plans";
import EditPlanModal from "../../../components/Modals/EditPlanModal/EditPlanModal";
import { ConditionModal } from "../../../components/Modals";
import { Spinner } from "../../../components/Spinner/Spinner";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";
import Pagination from "../../../components/Pagination/Pagination";
import { Plus, MoreVertical, Edit2, Trash2 } from "src/icons";
import { Button, Select } from "../../../components/ui";

const PAGE_SIZE = 50;

export const PlanAdmin = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [show, setShow] = useState<boolean>(false);
  const [showEdit, setShowEdit] = useState<boolean>(false);
  const [plans, setPlans] = useState<IPlans[]>([]);
  const [page, setPage] = useState<number>(0);
  const [loader, setLoader] = useState<boolean>(true);
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<IPlans | null>(null);
  const [drawerPlan, setDrawerPlan] = useState<IPlans | null>(null);
  const [planToDelete, setPlanToDelete] = useState<IPlans | null>(null);

  const getPlans = async () => {
    setLoader(true);
    try {
      const data: any = await trpc.plans.findManyPlans.query({
        where: showInactive ? {} : { activated: 1 },
      });
      setPlans(data);
    } catch {
      if (import.meta.env.DEV) {
        console.warn("[ADMIN][PLANS] Failed to load plans.");
      }
    } finally {
      setLoader(false);
    }
  };

  const closeModalAdd = () => setShow(false);
  const closeEditModalAdd = () => {
    setShowEdit(false);
    setEditingPlan(null);
  };

  const handleRemovePlan = async (id: number) => {
    try {
      await trpc.plans.deleteOnePlans.mutate({ where: { id } });
      setDrawerPlan(null);
      setPlanToDelete(null);
      getPlans();
    } catch {
      if (import.meta.env.DEV) {
        console.warn("[ADMIN][PLANS] Failed to delete plan.");
      }
    }
  };

  const handleEditPlan = (plan: IPlans) => {
    setEditingPlan(plan);
    setShowEdit(true);
    setDrawerPlan(null);
  };

  const getPaymentMethod = (plan: IPlans) => {
    if (plan.paypal_plan_id || plan.paypal_plan_id_test) return "PayPal";
    return "Stripe";
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") navigate("/");
  }, [currentUser, navigate]);

  useEffect(() => {
    getPlans();
  }, [showInactive]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(plans.length / PAGE_SIZE));
    setPage((prev) => Math.min(prev, totalPages - 1));
  }, [plans.length]);

  const pagePlans = plans.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const startFilter = (key: string, value: string | number) => {
    if (key !== "page") return;
    setPage(Number(value));
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[220px]">
        Mostrar
        <Select
          className="min-h-[44px] rounded-xl px-3 border border-border bg-bg-card text-text-main"
          value={showInactive ? "all" : "active"}
          onChange={(event) => {
            setPage(0);
            setShowInactive(event.target.value === "all");
          }}
        >
          <option value="active">Solo activos</option>
          <option value="all">Activos + inactivos</option>
        </Select>
      </label>
      <Button unstyled
        type="button"
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-2 bg-bear-gradient hover:opacity-95 text-bear-dark-500 font-medium rounded-lg px-4 py-2 transition-opacity"
      >
        <Plus size={18} />
        Crear Plan
      </Button>
    </div>
  );

  if (loader && plans.length === 0) {
    return (
      <AdminPageLayout
        title="Planes"
        subtitle="Gestiona catálogo comercial, precios y estado de activación por moneda y método de cobro."
      >
        <div className="flex justify-center py-12">
          <Spinner size={3} width={0.3} color="var(--app-accent)" />
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title={`Planes — ${plans.length}`}
      subtitle="Gestiona catálogo comercial, precios y estado de activación por moneda y método de cobro."
      toolbar={toolbar}
    >
      <AddPlanModal showModal={show} onHideModal={closeModalAdd} callPlans={getPlans} />
      <EditPlanModal showModal={showEdit} onHideModal={closeEditModalAdd} editingPlan={editingPlan} callPlans={getPlans} />
      <ConditionModal
        show={planToDelete !== null}
        onHide={() => setPlanToDelete(null)}
        title="Eliminar plan"
        message="¿Estás seguro de que deseas eliminar el plan?"
        action={() => planToDelete ? handleRemovePlan(planToDelete.id) : Promise.resolve()}
      />

      {/* Desktop: tabla */}
      <div className="admin-table-panel">
        <div
          className="overflow-x-auto max-h-[60vh] overflow-y-auto"
          tabIndex={0}
          role="region"
          aria-label="Tabla de planes (desliza para ver más)"
          data-scroll-region
        >
          <table className="w-full min-w-full lg:min-w-[700px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Nombre</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Método de pago</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4 hidden lg:table-cell">Descripción</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Moneda</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Precio</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Activo</th>
                <th className="uppercase text-xs tracking-wider text-right py-3 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagePlans.map((plan) => (
                <tr
                  key={plan.id}
                  className="border-b transition-colors"
                >
                  <td className="py-3 px-4 text-sm">{plan.name}</td>
                  <td className="py-3 px-4 text-sm">{getPaymentMethod(plan)}</td>
                  <td className="py-3 px-4 text-sm hidden lg:table-cell">{plan.description}</td>
                  <td className="py-3 px-4 text-sm">{plan.moneda?.toUpperCase()}</td>
                  <td className="py-3 px-4 text-sm">{plan.price}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`badge badge--tiny ${plan.activated === 1 ? "badge--success" : "badge--neutral"}`}
                    >
                      {plan.activated === 1 ? "Activo" : "No activo"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="table-actions">
                      <Button unstyled
                        type="button"
                        onClick={() => handleEditPlan(plan)}
                        className="btn-cell"
                        aria-label="Editar plan"
                      >
                        <Edit2 size={16} aria-hidden />
                      </Button>
                      <Button unstyled
                        type="button"
                        onClick={() => setPlanToDelete(plan)}
                        disabled={plan.paypal_plan_id != null}
                        className="btn-cell btn-cell--danger"
                        aria-label="Eliminar plan"
                      >
                        <Trash2 size={16} aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} className="py-3 px-4">
                  <Pagination
                    totalData={plans.length}
                    title="planes"
                    startFilter={startFilter}
                    currentPage={page}
                    limit={PAGE_SIZE}
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Mobile: lista compacta + drawer */}
      <div className="admin-mobile-list">
        {pagePlans.map((plan) => (
          <Button unstyled
            key={`m_${plan.id}`}
            className="admin-mobile-card"
            onClick={() => setDrawerPlan(plan)}
            type="button"
          >
            <div className="admin-mobile-card__head">
              <div className="admin-mobile-card__identity">
                <div className="admin-mobile-card__avatar">
                  {(plan.name || "P").charAt(0).toUpperCase()}
                </div>
                <div className="admin-mobile-card__copy">
                  <p className="admin-mobile-card__name">{plan.name}</p>
                  <p className="admin-mobile-card__email">{plan.moneda?.toUpperCase()} · {plan.price}</p>
                </div>
              </div>
              <span className={`admin-mobile-status ${plan.activated === 1 ? "is-active" : "is-blocked"}`}>
                {plan.activated === 1 ? "Activo" : "Inactivo"}
              </span>
              <span className="admin-mobile-card__menu" aria-hidden>
                <MoreVertical size={20} />
              </span>
            </div>
            <div className="admin-mobile-card__foot">
              <span>{getPaymentMethod(plan)}</span>
              <span>{plan.description || "Sin descripción"}</span>
            </div>
          </Button>
        ))}
      </div>

      <div className="admin-pagination-mobile">
        <Pagination
          totalData={plans.length}
          title="planes"
          startFilter={startFilter}
          currentPage={page}
          limit={PAGE_SIZE}
        />
      </div>

      <AdminDrawer
        open={drawerPlan !== null}
        onClose={() => setDrawerPlan(null)}
        title={drawerPlan?.name ?? "Plan"}
        user={undefined}
        actions={
          drawerPlan
            ? [
                { id: "edit", label: "Editar", onClick: () => handleEditPlan(drawerPlan), variant: "secondary" },
                {
                  id: "delete",
                  label: "Eliminar",
                  onClick: () => setPlanToDelete(drawerPlan),
                  disabled: drawerPlan.paypal_plan_id != null,
                  variant: "danger",
                },
              ]
            : []
        }
      >
        {drawerPlan && (
          <div className="space-y-2 text-sm">
            <p><span className="text-text-muted">Método:</span> {getPaymentMethod(drawerPlan)}</p>
            <p><span className="text-text-muted">Descripción:</span> {drawerPlan.description}</p>
            <p><span className="text-text-muted">Moneda:</span> {drawerPlan.moneda?.toUpperCase()}</p>
            <p><span className="text-text-muted">Precio:</span> {drawerPlan.price}</p>
            <p><span className="text-text-muted">Estado:</span> {drawerPlan.activated === 1 ? "Activo" : "No activo"}</p>
          </div>
        )}
      </AdminDrawer>
    </AdminPageLayout>
  );
};
