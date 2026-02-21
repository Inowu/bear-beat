import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "../../../components/Pagination/Pagination";
import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import { ARRAY_10 } from "../../../utils/Constants";
import CsvDownloader from "react-csv-downloader";
import { Search, Download, MoreVertical } from "src/icons";
import { IAdminOrders, ORDER_STATUS } from "../../../interfaces/admin";
import { of } from "await-of";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";
import { Input, Select, Button } from "../../../components/ui";

interface IAdminFilter {
  active: number;
  endDate: string;
  limit: number;
  page: number;
  paymentMethod: string;
  searchData: string;
  startDate: string;
  status: number | "";
}

interface OrdersFinancialSummary {
  totals: {
    totalOrders: number;
    grossRevenue: number;
    grossRevenueByCurrency: CurrencyTotals;
    grossRevenueConvertedMxn: number | null;
    avgOrderValue: number;
    avgOrderValueConvertedMxn: number | null;
  };
  byPaymentMethod: Array<{
    paymentMethod: string;
    totalOrders: number;
    grossRevenue: number;
    grossRevenueByCurrency: CurrencyTotals;
    grossRevenueConvertedMxn: number | null;
  }>;
  trend: {
    days: number | null;
    points: Array<{
      day: string;
      totalOrders: number;
      grossRevenue: number;
      grossRevenueByCurrency: CurrencyTotals;
      grossRevenueConvertedMxn: number | null;
    }>;
  };
}

interface CurrencyTotals {
  mxn: number;
  usd: number;
  other: number;
  convertedMxn: number | null;
  usdToMxnRate: number | null;
}

function getOrderStatusString(status: number) {
  switch (status) {
    case ORDER_STATUS.PENDING: return "Pendiente";
    case ORDER_STATUS.PAID: return "Pagada";
    case ORDER_STATUS.FAILED: return "Fallida";
    case ORDER_STATUS.CANCELLED: return "Cancelada";
    case ORDER_STATUS.EXPIRED: return "Expirada";
    default: return "Desconocido";
  }
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrencyCode(value: number | null | undefined, currency: string): string {
  if (value == null || Number.isNaN(value)) return "—";
  const code = (currency || "MXN").toUpperCase();
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrencyBreakdown(totals: CurrencyTotals | null | undefined): string {
  if (!totals) return "—";
  const parts: string[] = [];
  if ((totals.mxn ?? 0) > 0) parts.push(`MXN ${formatCurrencyCode(totals.mxn, "MXN")}`);
  if ((totals.usd ?? 0) > 0) parts.push(`USD ${formatCurrencyCode(totals.usd, "USD")}`);
  if ((totals.other ?? 0) > 0) {
    parts.push(
      `OTRAS ${totals.other.toLocaleString("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    );
  }
  return parts.length ? parts.join(" · ") : "—";
}

function Sparkline({ values }: { values: number[] }) {
  const width = 360;
  const height = 64;
  const padding = 6;
  if (!values.length) return <div className="text-sm text-text-muted">Sin datos</div>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values.map((v, i) => {
    const x = padding + (i * (width - padding * 2)) / Math.max(1, values.length - 1);
    const y = height - padding - ((v - min) * (height - padding * 2)) / span;
    return { x, y };
  });

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Tendencia"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--app-accent)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const Ordens = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [ordens, setOrdens] = useState<IAdminOrders[]>([]);
  const [totalLoader, setTotalLoader] = useState<boolean>(false);
  const [totalOrdens, setTotalOrdens] = useState(0);
  const [loader, setLoader] = useState<boolean>(true);
  const [drawerOrder, setDrawerOrder] = useState<IAdminOrders | null>(null);
  const [summary, setSummary] = useState<OrdersFinancialSummary | null>(null);
  const [filters, setFilters] = useState<IAdminFilter>({
    active: 1,
    endDate: "",
    limit: 50,
    page: 0,
    paymentMethod: "",
    searchData: "",
    startDate: "",
    status: ORDER_STATUS.PAID,
  });

  const buildDateRange = (start: string, end: string) => {
    const startVal = start ? `${start} 00:00:00` : "";
    const endVal = end ? `${end} 23:59:59` : "";
    if (!startVal && !endVal) return undefined;
    return {
      ...(startVal ? { gte: startVal } : {}),
      ...(endVal ? { lte: endVal } : {}),
    };
  };

  const startFilter = (key: string, value: string | number) => {
    const next = { ...filters, [key]: value };
    if (key !== "page") next.page = 0;
    setFilters(next);
  };

  const filterOrdens = async (filt: IAdminFilter) => {
    setLoader(true);
    setTotalLoader(true);
    try {
      const body: any = {
        take: filt.limit,
        skip: filt.page * filt.limit,
        email: filt.searchData,
        paymentMethod: filt.paymentMethod,
      };

      if (typeof filt.status === "number") {
        body.status = filt.status;
      }

      const dateRange = buildDateRange(filt.startDate, filt.endDate);
      if (dateRange) {
        body.date_order = dateRange;
      }

      const summaryBody: any = {
        email: body.email,
        paymentMethod: body.paymentMethod,
        ...(body.status != null ? { status: body.status } : {}),
        ...(body.date_order != null ? { date_order: body.date_order } : {}),
      };

      const [[res, err], [summaryRes]] = await Promise.all([
        of(trpc.orders.findManyOrdersWithUsers.query(body)),
        of(trpc.orders.getOrdersFinancialSummary.query(summaryBody)),
      ]);

      if (!err && res) {
        setOrdens(res.data);
        setTotalOrdens(res.count);
      }
      if (summaryRes) {
        setSummary(summaryRes as OrdersFinancialSummary);
      }
    } finally {
      setLoader(false);
      setTotalLoader(false);
    }
  };

  const transformOrdersToExport = async () => {
    const body: any = {
      take: 0,
      skip: 0,
      email: filters.searchData,
      paymentMethod: filters.paymentMethod,
    };
    if (typeof filters.status === "number") {
      body.status = filters.status;
    }
    const dateRange = buildDateRange(filters.startDate, filters.endDate);
    if (dateRange) {
      body.date_order = dateRange;
    }
    const [res, err] = await of(trpc.orders.findManyOrdersWithUsers.query(body));
    if (err || !res) return [];
    return res.data.map((o: any) => ({
      Orden: o.id,
      Correo: o.email,
      Telefono: o.phone,
      "Metodo de pago": o.payment_method,
      "Id de la suscripcion": o.txn_id,
      Precio: o.total_price,
      Fecha: o.date_order.toLocaleDateString(),
      Estado: getOrderStatusString(o.status),
    }));
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") navigate("/");
  }, [currentUser, navigate]);

  useEffect(() => {
    filterOrdens(filters);
  }, [filters]);

  const toolbar = (
    <div className="flex flex-wrap items-end gap-2 w-full" data-testid="orders-toolbar">
      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[240px] flex-1">
        Buscar
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" aria-hidden />
          <Input
            id="orders-search"
            type="text"
            placeholder="Buscar por email o teléfono…"
            value={filters.searchData}
            onChange={(e) => startFilter("searchData", e.target.value)}
            className="pl-9"
          />
        </div>
      </label>

      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[200px]">
        Método
        <Select
          value={filters.paymentMethod}
          onChange={(e) => startFilter("paymentMethod", e.target.value)}
        >
          <option value="">Todos</option>
          <option value="Paypal">Paypal</option>
          <option value="Stripe">Stripe</option>
          <option value="Conekta">Conekta (SPEI/Efectivo/BBVA)</option>
          <option value="Admin">Admin</option>
        </Select>
      </label>

      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[200px]">
        Estado
        <Select
          value={filters.status}
          onChange={(e) => startFilter("status", e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">Todos</option>
          <option value={ORDER_STATUS.PAID}>Pagada</option>
          <option value={ORDER_STATUS.PENDING}>Pendiente</option>
          <option value={ORDER_STATUS.FAILED}>Fallida</option>
          <option value={ORDER_STATUS.CANCELLED}>Cancelada</option>
          <option value={ORDER_STATUS.EXPIRED}>Expirada</option>
        </Select>
      </label>

      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[190px]">
        Desde
        <Input
          type="date"
          value={filters.startDate}
          onChange={(e) => startFilter("startDate", e.target.value)}
        />
      </label>

      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[190px]">
        Hasta
        <Input
          type="date"
          value={filters.endDate}
          onChange={(e) => startFilter("endDate", e.target.value)}
        />
      </label>

      <Button unstyled
        type="button"
        onClick={() => {
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, "0");
          const dd = String(today.getDate()).padStart(2, "0");
          const iso = `${yyyy}-${mm}-${dd}`;
          setFilters((prev) => ({ ...prev, startDate: iso, endDate: iso, page: 0 }));
        }}
        className="min-h-[44px] rounded-xl px-4 border border-border bg-bg-card text-text-main font-semibold hover:bg-bg-input transition-colors"
      >
        Hoy
      </Button>

      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[150px]">
        Por página
        <Select value={filters.limit} onChange={(e) => startFilter("limit", +e.target.value)}>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
        </Select>
      </label>

      <CsvDownloader
        filename="lista_de_ordenes"
        extension=".csv"
        separator=";"
        wrapColumnChar=""
        datas={transformOrdersToExport}
        text=""
      >
        <span className="inline-flex items-center gap-2 bg-bear-gradient text-bear-dark-500 hover:opacity-95 font-medium rounded-pill px-4 py-2 transition-colors">
          <Download size={18} aria-hidden />
          Exportar
        </span>
      </CsvDownloader>
    </div>
  );

  const statusBadge = (status: number) => {
    const s = getOrderStatusString(status);
    const variant =
      status === ORDER_STATUS.PAID
        ? "badge--success"
        : status === ORDER_STATUS.PENDING
          ? "badge--neutral"
          : "badge--danger";
    return <span className={`badge badge--tiny ${variant}`}>{s}</span>;
  };

  return (
    <AdminPageLayout
      title="Órdenes"
      subtitle="Consulta pagos, filtra por método/estado y exporta la operación histórica en un clic."
      toolbar={toolbar}
    >
      <div className="w-full overflow-x-hidden">
        {summary ? (
          <div className="admin-table-panel mb-4">
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border bg-bg-card p-4">
                <p className="text-xs uppercase tracking-wider text-text-muted">Órdenes</p>
                <p className="text-2xl font-bold">{summary.totals.totalOrders.toLocaleString("es-MX")}</p>
              </div>
              <div className="rounded-xl border border-border bg-bg-card p-4">
                <p className="text-xs uppercase tracking-wider text-text-muted">Ingreso bruto</p>
                <p className="text-lg font-bold">{formatCurrencyBreakdown(summary.totals.grossRevenueByCurrency)}</p>
                <p className="text-xs text-text-muted mt-1">
                  Total conv: {formatCurrency(summary.totals.grossRevenueConvertedMxn)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-bg-card p-4">
                <p className="text-xs uppercase tracking-wider text-text-muted">Ticket promedio</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(summary.totals.avgOrderValueConvertedMxn)}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Conv. MXN
                </p>
              </div>
              <div className="rounded-xl border border-border bg-bg-card p-4">
                <p className="text-xs uppercase tracking-wider text-text-muted">Tendencia</p>
                <Sparkline
                  values={summary.trend.points.map((p) => (
                    p.grossRevenueConvertedMxn != null
                      ? p.grossRevenueConvertedMxn
                      : p.grossRevenue
                  ))}
                />
                <p className="text-xs text-text-muted mt-1">
                  {summary.trend.days ? `Últimos ${summary.trend.days} días` : "Rango seleccionado"}
                </p>
              </div>
            </div>

            <div className="px-4 pb-4">
              <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
                <div className="p-3 border-b border-border">
                  <p className="font-semibold">Desglose por método</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full lg:min-w-[520px] text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-3">Método</th>
                        <th className="p-3">Órdenes</th>
                        <th className="p-3">Ingreso (desglose)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.byPaymentMethod.map((row) => (
                        <tr key={row.paymentMethod} className="border-t border-border">
                          <td className="p-3">{row.paymentMethod}</td>
                          <td className="p-3">{row.totalOrders.toLocaleString("es-MX")}</td>
                          <td className="p-3">
                            {formatCurrencyBreakdown(row.grossRevenueByCurrency)}
                            <div className="text-xs text-text-muted mt-1">
                              Conv: {formatCurrency(row.grossRevenueConvertedMxn)}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {summary.byPaymentMethod.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-3 text-text-muted">
                            Sin datos para los filtros actuales.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Tabla desktop (patrón BEAR BEAT PRO) */}
        <div className="admin-table-panel">
          <div
            className="overflow-x-auto max-h-[60vh] overflow-y-auto"
            tabIndex={0}
            role="region"
            aria-label="Tabla de órdenes (desliza para ver más columnas)"
            data-scroll-region
          >
            <table className="w-full min-w-full lg:min-w-[1110px] text-left text-sm border-collapse table-fixed">
              <thead>
                <tr>
                  <th className="p-4 w-[90px]">No. Orden</th>
                  <th className="p-4 w-[220px]">Correo</th>
                  <th className="p-4 hidden lg:table-cell w-[160px]">Teléfono</th>
                  <th className="p-4 w-[120px]">Método</th>
                  <th className="p-4 hidden lg:table-cell w-[170px]">Id suscripción</th>
                  <th className="p-4 w-[110px]">Precio</th>
                  <th className="p-4 w-[120px]">Fecha</th>
                  <th className="p-4 w-[120px]">Estado</th>
                </tr>
              </thead>
              <tbody>
                {!loader
                  ? ordens.map((orden, index) => (
                      <tr
                        key={`order_${index}`}
                        className="border-b transition-colors"
                      >
                        <td className="py-4 px-4">{orden.id}</td>
                        <td className="py-4 px-4 truncate" title={orden.email}>{orden.email}</td>
                        <td className="py-4 px-4 hidden lg:table-cell truncate" title={orden.phone ?? ""}>{orden.phone}</td>
                        <td className="py-4 px-4 truncate" title={orden.payment_method ?? "—"}>{orden.payment_method ?? "—"}</td>
                        <td className="py-4 px-4 hidden lg:table-cell truncate" title={orden.txn_id ?? ""}>{orden.txn_id}</td>
                        <td className="py-4 px-4">{orden.total_price}</td>
                        <td className="py-4 px-4">{orden.date_order.toLocaleDateString()}</td>
                        <td className="py-4 px-4">{statusBadge(orden.status)}</td>
                      </tr>
                    ))
                  : ARRAY_10.map((_, i) => (
                      <tr key={`skeleton_${i}`} className="border-b">
                        <td colSpan={8} className="py-4 px-4 animate-pulse bg-bg-input" />
                      </tr>
                    ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8} className="p-4">
                    <Pagination
                    totalLoader={totalLoader}
                    totalData={totalOrdens}
                    title="ordenes"
                    startFilter={startFilter}
                    currentPage={filters.page}
                    limit={filters.limit}
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

        {/* Cards móvil (patrón BEAR BEAT PRO) */}
        <div className="admin-mobile-list">
          {!loader
            ? ordens.length > 0
              ? ordens.map((orden, index) => (
                  <Button unstyled
                    key={`m_${index}`}
                    className="admin-mobile-card"
                    onClick={() => setDrawerOrder(orden)}
                    type="button"
                    aria-label={`Ver orden ${orden.id}`}
                  >
                    <div className="admin-mobile-card__head">
                      <div className="admin-mobile-card__identity">
                        <div className="admin-mobile-card__avatar">
                          {(orden.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="admin-mobile-card__copy">
                          <p className="admin-mobile-card__name">Orden #{orden.id}</p>
                          <p className="admin-mobile-card__email">{orden.email}</p>
                        </div>
                      </div>
                      {statusBadge(orden.status)}
                      <span className="admin-mobile-card__menu" aria-hidden>
                        <MoreVertical size={20} />
                      </span>
                    </div>
                    <div className="admin-mobile-card__foot">
                      <span>{orden.payment_method ?? "—"}</span>
                      <span>{orden.total_price}</span>
                      <span>{orden.date_order.toLocaleDateString()}</span>
                    </div>
                  </Button>
                ))
              : (
                  <div className="admin-mobile-empty">
                    <h2>No hay órdenes</h2>
                    <p>Prueba ajustar los filtros para ver resultados.</p>
                  </div>
                )
            : ARRAY_10.map((_, i) => (
                <div key={`s_${i}`} className="admin-mobile-card admin-mobile-card--skeleton">
                  <div className="admin-mobile-card__head">
                    <div className="admin-mobile-card__identity">
                      <div className="admin-mobile-card__avatar" />
                      <div className="admin-mobile-card__copy">
                        <p className="admin-mobile-card__name">—</p>
                        <p className="admin-mobile-card__email">—</p>
                      </div>
                    </div>
                  </div>
                  <div className="admin-mobile-card__foot">
                    <span>—</span>
                    <span>—</span>
                    <span>—</span>
                  </div>
                </div>
              ))}
        </div>

        <div className="admin-pagination-mobile mt-4">
          <Pagination
            totalLoader={totalLoader}
            totalData={totalOrdens}
            title="ordenes"
            startFilter={startFilter}
            currentPage={filters.page}
            limit={filters.limit}
          />
        </div>
      </div>

      <AdminDrawer
        open={drawerOrder !== null}
        onClose={() => setDrawerOrder(null)}
        title={drawerOrder ? `Orden #${drawerOrder.id}` : "Orden"}
        user={undefined}
      >
        {drawerOrder && (
          <div className="space-y-2 text-sm">
            <p><span className="text-text-muted">Correo:</span> {drawerOrder.email}</p>
            <p><span className="text-text-muted">Teléfono:</span> {drawerOrder.phone}</p>
            <p><span className="text-text-muted">Método:</span> {drawerOrder.payment_method ?? "—"}</p>
            <p><span className="text-text-muted">Id suscripción:</span> {drawerOrder.txn_id}</p>
            <p><span className="text-text-muted">Precio:</span> {drawerOrder.total_price}</p>
            <p><span className="text-text-muted">Fecha:</span> {drawerOrder.date_order.toLocaleDateString()}</p>
            <p><span className="text-text-muted">Estado:</span> {getOrderStatusString(drawerOrder.status)}</p>
          </div>
        )}
      </AdminDrawer>
    </AdminPageLayout>
  );
};
