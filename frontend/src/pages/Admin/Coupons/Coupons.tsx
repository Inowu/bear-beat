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
import { Plus, MoreVertical, Edit2, Trash2 } from "lucide-react";

export const Coupons = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [show, setShow] = useState<boolean>(false);
  const [showEdit, setShowEdit] = useState<boolean>(false);
  const [coupons, setCoupons] = useState<IAdminCoupons[]>([]);
  const [loader, setLoader] = useState<boolean>(true);
  const [editingCoupon, setEditingCoupon] = useState<IAdminCoupons | null>(null);
  const [drawerCoupon, setDrawerCoupon] = useState<IAdminCoupons | null>(null);
  const [couponToDelete, setCouponToDelete] = useState<IAdminCoupons | null>(null);

  const getCoupons = async () => {
    try {
      const data: any = await trpc.cupons.findManyCupons.query({ where: {} });
      setCoupons(data);
    } catch (error) {
      console.log(error);
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
    } catch (error) {
      console.log(error);
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
      <AdminPageLayout title="Cupones">
        <div className="flex justify-center py-12">
          <Spinner size={3} width={0.3} color="var(--app-accent)" />
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout title="Cupones" toolbar={toolbar}>
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
        <p className="text-slate-400 py-8 text-center">No se encontraron cupones.</p>
      ) : (
        <>
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50 hidden md:block">
            <div
              className="overflow-x-auto max-h-[60vh] overflow-y-auto"
              tabIndex={0}
              role="region"
              aria-label="Tabla de cupones (desliza para ver más)"
              data-scroll-region
            >
              <table className="w-full min-w-[500px]">
                <thead className="bg-slate-900 sticky top-0 z-10">
                  <tr>
                    <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4">Código</th>
                    <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4 hidden lg:table-cell">Descripción</th>
                    <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4">Descuento</th>
                    <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4">Activo</th>
                    <th className="text-slate-400 uppercase text-xs tracking-wider text-right py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-950">
                  {coupons.map((c, index) => (
                    <tr key={`coupon_${index}`} className="border-b border-slate-800 hover:bg-slate-900/60 transition-colors">
                      <td className="py-3 px-4 text-sm text-slate-300 font-medium">{c.code}</td>
                      <td className="py-3 px-4 text-sm text-slate-300 hidden lg:table-cell">{c.description}</td>
                      <td className="py-3 px-4 text-sm text-slate-300">{c.discount} %</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex text-xs px-2 py-1 rounded-full ${
                            c.active === 1 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"
                          }`}
                        >
                          {c.active === 1 ? "Activo" : "No activo"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditCoupon(c)}
                            className="p-2 text-slate-400 hover:text-bear-cyan transition-colors rounded-lg hover:bg-slate-800"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCouponToDelete(c)}
                            className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="md:hidden flex flex-col rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
            {coupons.map((c, index) => (
              <button
                type="button"
                key={`m_${index}`}
                className="flex items-center justify-between gap-3 min-h-[64px] w-full px-4 py-3 border-b border-slate-800 hover:bg-slate-900/60 active:bg-slate-800 text-left"
                onClick={() => setDrawerCoupon(c)}
                aria-label={`Ver acciones del cupón ${c.code}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white text-sm">{c.code}</p>
                  <p className="text-slate-400 text-xs">{c.discount} % descuento</p>
                </div>
                <span
                  className={`shrink-0 text-xs px-2 py-1 rounded-full ${
                    c.active === 1 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"
                  }`}
                >
                  {c.active === 1 ? "Activo" : "Inactivo"}
                </span>
                <span className="p-2 text-slate-400 hover:text-bear-cyan rounded-lg" aria-hidden>
                  <MoreVertical size={20} />
                </span>
              </button>
            ))}
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
              <div className="space-y-2 text-sm text-slate-300">
                <p><span className="text-slate-500">Descripción:</span> {drawerCoupon.description}</p>
                <p><span className="text-slate-500">Descuento:</span> {drawerCoupon.discount} %</p>
                <p><span className="text-slate-500">Estado:</span> {drawerCoupon.active === 1 ? "Activo" : "No activo"}</p>
              </div>
            )}
          </AdminDrawer>
        </>
      )}
    </AdminPageLayout>
  );
};
