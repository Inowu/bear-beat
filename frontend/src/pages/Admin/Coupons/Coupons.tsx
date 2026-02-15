import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import "./Coupons.scss";
import { AddCouponModal } from "../../../components/Modals/AddCouponModal/AddCouponModal";
import { EditCouponModal } from "../../../components/Modals/EditCouponModal/EditCouponModal";
import { ConditionModal } from "../../../components/Modals";
import { Spinner } from "../../../components/Spinner/Spinner";
import { IAdminCoupons } from "interfaces/admin";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";
import Pagination from "../../../components/Pagination/Pagination";
import { Plus, MoreVertical, Edit2, Trash2 } from "src/icons";

const PAGE_SIZE = 100;

export const Coupons = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [show, setShow] = useState<boolean>(false);
  const [showEdit, setShowEdit] = useState<boolean>(false);
  const [coupons, setCoupons] = useState<IAdminCoupons[]>([]);
  const [page, setPage] = useState<number>(0);
  const [loader, setLoader] = useState<boolean>(true);
  const [editingCoupon, setEditingCoupon] = useState<IAdminCoupons | null>(null);
  const [drawerCoupon, setDrawerCoupon] = useState<IAdminCoupons | null>(null);
  const [couponToDelete, setCouponToDelete] = useState<IAdminCoupons | null>(null);

  const getCoupons = async () => {
    try {
      const data: any = await trpc.cupons.findManyCupons.query({ where: {} });
      setCoupons(data);
    } catch {
      if (import.meta.env.DEV) {
        console.warn("[ADMIN][COUPONS] Failed to load coupons.");
      }
    } finally {
      setLoader(false);
    }
  };

  const closeModalAdd = () => setShow(false);
  const closeEditModalAdd = () => {
    setShowEdit(false);
    setEditingCoupon(null);
    setDrawerCoupon(null);
  };

  const handleRemoveCoupon = async (code: string) => {
    try {
      await trpc.cupons.deleteStripeCupon.mutate({ code });
      setDrawerCoupon(null);
      setCouponToDelete(null);
      getCoupons();
    } catch {
      if (import.meta.env.DEV) {
        console.warn("[ADMIN][COUPONS] Failed to delete coupon.");
      }
    }
  };

  const handleEditCoupon = (coupon: IAdminCoupons) => {
    setEditingCoupon(coupon);
    setShowEdit(true);
    setDrawerCoupon(null);
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") navigate("/");
  }, [currentUser, navigate]);

  useEffect(() => {
    getCoupons();
  }, []);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(coupons.length / PAGE_SIZE));
    setPage((prev) => Math.min(prev, totalPages - 1));
  }, [coupons.length]);

  const pageCoupons = coupons.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const startFilter = (key: string, value: string | number) => {
    if (key !== "page") return;
    setPage(Number(value));
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
      <button
        type="button"
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-2 bg-bear-gradient text-bear-dark-500 hover:opacity-95 font-medium rounded-pill px-4 py-2 transition-colors"
      >
        <Plus size={18} />
        Crear cupón
      </button>
    </div>
  );

  if (loader && coupons.length === 0) {
    return (
      <AdminPageLayout
        title="Cupones"
        subtitle="Crea y administra promociones activas para reducir fricción de compra y aumentar conversión."
      >
        <div className="flex justify-center py-12">
          <Spinner size={3} width={0.3} color="var(--app-accent)" />
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Cupones"
      subtitle="Crea y administra promociones activas para reducir fricción de compra y aumentar conversión."
      toolbar={toolbar}
    >
      <AddCouponModal showModal={show} onHideModal={closeModalAdd} getCoupons={getCoupons} />
      <EditCouponModal
        showModal={showEdit}
        onHideModal={closeEditModalAdd}
        editingCoupon={editingCoupon}
        getCoupons={getCoupons}
      />
      <ConditionModal
        show={couponToDelete !== null}
        onHide={() => setCouponToDelete(null)}
        title="Eliminar cupón"
        message="¿Estás seguro de que deseas eliminar el cupón?"
        action={() => couponToDelete ? handleRemoveCoupon(couponToDelete.code) : Promise.resolve()}
      />

      {coupons.length === 0 ? (
        <p className="text-text-muted py-8 text-center">No se encontraron cupones.</p>
      ) : (
        <>
          <div className="admin-table-panel">
            <div
              className="overflow-x-auto max-h-[60vh] overflow-y-auto"
              tabIndex={0}
              role="region"
              aria-label="Tabla de cupones (desliza para ver más)"
              data-scroll-region
            >
              <table className="w-full min-w-[500px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Código</th>
                    <th className="uppercase text-xs tracking-wider text-left py-3 px-4 hidden lg:table-cell">Descripción</th>
                    <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Descuento</th>
                    <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Activo</th>
                    <th className="uppercase text-xs tracking-wider text-right py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageCoupons.map((c) => (
                    <tr key={c.code} className="border-b transition-colors">
                      <td className="py-3 px-4 text-sm font-medium">{c.code}</td>
                      <td className="py-3 px-4 text-sm hidden lg:table-cell">{c.description}</td>
                      <td className="py-3 px-4 text-sm">{c.discount} %</td>
                      <td className="py-3 px-4">
                        <span
                          className={`badge badge--tiny ${c.active === 1 ? "badge--success" : "badge--neutral"}`}
                        >
                          {c.active === 1 ? "Activo" : "No activo"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="table-actions">
                          <button
                            type="button"
                            onClick={() => handleEditCoupon(c)}
                            className="btn-cell"
                            title="Editar"
                            aria-label={`Editar cupón ${c.code}`}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCouponToDelete(c)}
                            className="btn-cell btn-cell--danger"
                            title="Eliminar"
                            aria-label={`Eliminar cupón ${c.code}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="py-3 px-4">
                      <Pagination
                        totalData={coupons.length}
                        title="cupones"
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

          <div className="admin-mobile-list">
            {pageCoupons.map((c) => (
              <button
                type="button"
                key={`m_${c.code}`}
                className="admin-mobile-card"
                onClick={() => setDrawerCoupon(c)}
                aria-label={`Ver acciones del cupón ${c.code}`}
              >
                <div className="admin-mobile-card__head">
                  <div className="admin-mobile-card__identity">
                    <div className="admin-mobile-card__avatar">{c.code?.charAt(0).toUpperCase()}</div>
                    <div className="admin-mobile-card__copy">
                      <p className="admin-mobile-card__name">{c.code}</p>
                      <p className="admin-mobile-card__email">{c.discount} % descuento</p>
                    </div>
                  </div>
                  <span className={`admin-mobile-status ${c.active === 1 ? "is-active" : "is-blocked"}`}>
                    {c.active === 1 ? "Activo" : "Inactivo"}
                  </span>
                  <span className="admin-mobile-card__menu" aria-hidden>
                    <MoreVertical size={20} />
                  </span>
                </div>
                <div className="admin-mobile-card__foot">
                  <span>{c.description || "Sin descripción"}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="admin-pagination-mobile">
            <Pagination
              totalData={coupons.length}
              title="cupones"
              startFilter={startFilter}
              currentPage={page}
              limit={PAGE_SIZE}
            />
          </div>

          <AdminDrawer
            open={drawerCoupon !== null}
            onClose={() => setDrawerCoupon(null)}
            title={drawerCoupon?.code ?? "Cupón"}
            user={undefined}
            actions={
              drawerCoupon
                ? [
                    { id: "edit", label: "Editar", onClick: () => handleEditCoupon(drawerCoupon), variant: "secondary" },
                    { id: "delete", label: "Eliminar", onClick: () => setCouponToDelete(drawerCoupon), variant: "danger" },
                  ]
                : []
            }
          >
            {drawerCoupon && (
              <div className="space-y-2 text-sm">
                <p><span className="text-text-muted">Descripción:</span> {drawerCoupon.description}</p>
                <p><span className="text-text-muted">Descuento:</span> {drawerCoupon.discount} %</p>
                <p><span className="text-text-muted">Estado:</span> {drawerCoupon.active === 1 ? "Activo" : "No activo"}</p>
              </div>
            )}
          </AdminDrawer>
        </>
      )}
    </AdminPageLayout>
  );
};
