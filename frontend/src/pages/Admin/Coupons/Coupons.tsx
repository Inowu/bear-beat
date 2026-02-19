import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import { AddCouponModal } from "../../../components/Modals/AddCouponModal/AddCouponModal";
import { EditCouponModal } from "../../../components/Modals/EditCouponModal/EditCouponModal";
import { ConditionModal } from "../../../components/Modals";
import { Spinner } from "../../../components/Spinner/Spinner";
import { IAdminCoupons } from "interfaces/admin";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";
import Pagination from "../../../components/Pagination/Pagination";
import { Plus, MoreVertical, Edit2, Trash2, RefreshCw } from "src/icons";
import { Select, Button } from "../../../components/ui";

const PAGE_SIZE = 50;

interface CouponMetricsCurrencyBreakdownRow {
  currency: string;
  paidOrders: number;
  grossRevenue: number;
  discountGiven: number;
  netRevenue: number;
}

interface CouponMetricsRow {
  couponId: number;
  code: string;
  description: string | null;
  discountPct: number;
  active: number;
  paidOrders: number;
  uniqueUsers: number;
  currency: string | null;
  grossRevenue: number | null;
  discountGiven: number | null;
  netRevenue: number | null;
  roiNetOverDiscount: number | null;
  lastUsedAt: string | null;
  currencyBreakdown: CouponMetricsCurrencyBreakdownRow[];
}

interface CouponMetricsSnapshot {
  range: { days: number; start: string; end: string };
  total: number;
  items: CouponMetricsRow[];
}

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
  const [metricsDays, setMetricsDays] = useState<number>(30);
  const [metrics, setMetrics] = useState<CouponMetricsSnapshot | null>(null);
  const [metricsLoading, setMetricsLoading] = useState<boolean>(false);
  const [metricsError, setMetricsError] = useState<string>("");

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

  const formatMoney = (value: number | null | undefined, currency: string | null) => {
    if (value == null || !Number.isFinite(value)) return "—";
    const ccy = (currency || "MXN").toUpperCase();
    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: ccy,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${ccy}`;
    }
  };

  const formatDateTime = (raw: string | null | undefined) => {
    if (!raw) return "—";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  };

  const fetchCouponMetrics = async (days: number) => {
    setMetricsLoading(true);
    try {
      const snapshot = (await trpc.analytics.getAnalyticsCouponMetrics.query({
        days,
        limit: 50,
        page: 0,
      })) as CouponMetricsSnapshot;
      setMetrics(snapshot);
      setMetricsError("");
    } catch {
      setMetrics(null);
      setMetricsError("No se pudieron cargar las métricas de cupones. Intenta nuevamente.");
    } finally {
      setMetricsLoading(false);
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
    void fetchCouponMetrics(metricsDays);
  }, [metricsDays]);

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
      <Button unstyled
        type="button"
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-2 bg-bear-gradient text-bear-dark-500 hover:opacity-95 font-medium rounded-pill px-4 py-2 transition-colors"
      >
        <Plus size={18} />
        Crear cupón
      </Button>
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

      <div className="admin-table-panel mb-6">
        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-text-main text-sm font-semibold">Métricas de cupones</h2>
              <p className="text-text-muted text-xs mt-1">
                Ventana: últimos {metricsDays} días. Montos solo se muestran cuando el cupón se usó en 1 moneda; si no, verás el desglose.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[170px]">
                Rango
                <Select value={metricsDays} onChange={(e) => setMetricsDays(Number(e.target.value))}>
                  <option value={7}>7 días</option>
                  <option value={30}>30 días</option>
                  <option value={90}>90 días</option>
                  <option value={120}>120 días</option>
                </Select>
              </label>
              <Button unstyled
                type="button"
                onClick={() => fetchCouponMetrics(metricsDays)}
                disabled={metricsLoading}
                className="inline-flex items-center gap-2 bg-bg-card hover:bg-bg-input text-text-main font-medium rounded-pill px-4 py-2 border border-border transition-colors disabled:opacity-50"
                title="Actualizar métricas"
              >
                <RefreshCw size={18} />
                {metricsLoading ? "Actualizando…" : "Actualizar"}
              </Button>
            </div>
          </div>

          {metricsError ? (
            <p className="text-sm text-danger-400">{metricsError}</p>
          ) : metricsLoading && !metrics ? (
            <div className="flex justify-center py-8">
              <Spinner size={2.5} width={0.28} color="var(--app-accent)" />
            </div>
          ) : metrics && metrics.items.length > 0 ? (
            <div
              className="overflow-x-auto max-h-[50vh] overflow-y-auto"
              tabIndex={0}
              role="region"
              aria-label="Tabla de métricas de cupones"
              data-scroll-region
            >
              <table className="w-full min-w-[900px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Cupón</th>
                    <th className="uppercase text-xs tracking-wider text-right py-3 px-4">Usos</th>
                    <th className="uppercase text-xs tracking-wider text-right py-3 px-4">Usuarios</th>
                    <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Moneda</th>
                    <th className="uppercase text-xs tracking-wider text-right py-3 px-4">Revenue neto</th>
                    <th className="uppercase text-xs tracking-wider text-right py-3 px-4">Descuento</th>
                    <th className="uppercase text-xs tracking-wider text-right py-3 px-4">ROI</th>
                    <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Último uso</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.items.map((row) => {
                    const currencyLabel = row.currency ? row.currency : row.currencyBreakdown.length > 1 ? "Mixto" : "—";
                    const breakdownLabel =
                      row.currencyBreakdown.length > 1
                        ? row.currencyBreakdown
                            .map((b) => `${b.currency}: ${formatMoney(b.netRevenue, b.currency)}`)
                            .join(" · ")
                        : "";
                    const roiLabel =
                      row.roiNetOverDiscount == null || !Number.isFinite(row.roiNetOverDiscount)
                        ? "—"
                        : `${row.roiNetOverDiscount.toFixed(2)}x`;

                    return (
                      <tr key={`m_${row.couponId}`} className="border-b transition-colors">
                        <td className="py-3 px-4 text-sm font-medium">
                          <div className="flex flex-col">
                            <span>{row.code}</span>
                            <span className="text-xs text-text-muted">
                              {row.discountPct}% {row.active === 1 ? "· Activo" : "· Inactivo"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-right">{row.paidOrders.toLocaleString("es-MX")}</td>
                        <td className="py-3 px-4 text-sm text-right">{row.uniqueUsers.toLocaleString("es-MX")}</td>
                        <td className="py-3 px-4 text-sm">
                          <div className="flex flex-col">
                            <span>{currencyLabel}</span>
                            {breakdownLabel ? (
                              <span className="text-xs text-text-muted">{breakdownLabel}</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          {row.netRevenue == null ? "—" : formatMoney(row.netRevenue, row.currency)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          {row.discountGiven == null ? "—" : formatMoney(row.discountGiven, row.currency)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">{roiLabel}</td>
                        <td className="py-3 px-4 text-sm">{formatDateTime(row.lastUsedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-text-muted text-sm">Sin actividad de cupones en este rango.</p>
          )}
        </div>
      </div>

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
                          <Button unstyled
                            type="button"
                            onClick={() => handleEditCoupon(c)}
                            className="btn-cell"
                            title="Editar"
                            aria-label={`Editar cupón ${c.code}`}
                          >
                            <Edit2 size={16} />
                          </Button>
                          <Button unstyled
                            type="button"
                            onClick={() => setCouponToDelete(c)}
                            className="btn-cell btn-cell--danger"
                            title="Eliminar"
                            aria-label={`Eliminar cupón ${c.code}`}
                          >
                            <Trash2 size={16} />
                          </Button>
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
              <Button unstyled
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
              </Button>
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
