import trpc from "../../../api";
import "./PlanAdmin.scss";
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

const PAGE_SIZE = 100;

export const PlanAdmin = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [show, setShow] = useState<boolean>(false);
  const [showEdit, setShowEdit] = useState<boolean>(false);
  const [plans, setPlans] = useState<IPlans[]>([]);
  const [page, setPage] = useState<number>(0);
  const [loader, setLoader] = useState<boolean>(true);
  const [editingPlan, setEditingPlan] = useState<IPlans | null>(null);
  const [drawerPlan, setDrawerPlan] = useState<IPlans | null>(null);
  const [planToDelete, setPlanToDelete] = useState<IPlans | null>(null);

  const getPlans = async () => {
    try {
      const data: any = await trpc.plans.findManyPlans.query({ where: {} });
      setPlans(data);
    } catch (error) {
      console.log(error);
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
    } catch (error) {
      console.log(error);
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
  }, []);

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
      <button
        type="button"
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-2 bg-bear-gradient hover:opacity-95 text-bear-dark-500 font-medium rounded-lg px-4 py-2 transition-opacity"
      >
        <Plus size={18} />
        Crear Plan
      </button>
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
      <div className="admin-table-panel rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
        <div
          className="overflow-x-auto max-h-[60vh] overflow-y-auto"
          tabIndex={0}
          role="region"
          aria-label="Tabla de planes (desliza para ver más)"
          data-scroll-region
        >
          <table className="w-full min-w-[700px]">
            <thead className="bg-slate-900 sticky top-0 z-10">
              <tr>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4">Nombre</th>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4">Método de pago</th>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4 hidden lg:table-cell">Descripción</th>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4">Moneda</th>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4">Precio</th>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4">Activo</th>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-right py-3 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-slate-950">
              {pagePlans.map((plan) => (
                <tr
                  key={plan.id}
                  className="border-b border-slate-800 hover:bg-slate-900/60 transition-colors"
                >
                  <td className="py-3 px-4 text-sm text-slate-300">{plan.name}</td>
                  <td className="py-3 px-4 text-sm text-slate-300">{getPaymentMethod(plan)}</td>
                  <td className="py-3 px-4 text-sm text-slate-300 hidden lg:table-cell">{plan.description}</td>
                  <td className="py-3 px-4 text-sm text-slate-300">{plan.moneda?.toUpperCase()}</td>
                  <td className="py-3 px-4 text-sm text-slate-300">{plan.price}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex text-xs px-2 py-1 rounded-full ${
                        plan.activated === 1 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"
                      }`}
                    >
                      {plan.activated === 1 ? "Activo" : "No activo"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditPlan(plan)}
                        className="p-2 text-slate-400 hover:text-bear-cyan transition-colors rounded-lg hover:bg-slate-800"
                        aria-label="Editar plan"
                      >
                        <Edit2 size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlanToDelete(plan)}
                        disabled={plan.paypal_plan_id != null}
                        className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Eliminar plan"
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-900">
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
          <button
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
          </button>
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
          <div className="space-y-2 text-sm text-slate-300">
            <p><span className="text-slate-500">Método:</span> {getPaymentMethod(drawerPlan)}</p>
            <p><span className="text-slate-500">Descripción:</span> {drawerPlan.description}</p>
            <p><span className="text-slate-500">Moneda:</span> {drawerPlan.moneda?.toUpperCase()}</p>
            <p><span className="text-slate-500">Precio:</span> {drawerPlan.price}</p>
            <p><span className="text-slate-500">Estado:</span> {drawerPlan.activated === 1 ? "Activo" : "No activo"}</p>
          </div>
        )}
      </AdminDrawer>
    </AdminPageLayout>
  );
};
