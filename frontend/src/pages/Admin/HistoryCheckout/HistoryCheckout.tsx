import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CsvDownloader from "react-csv-downloader";
import { Download, MoreVertical } from "src/icons";
import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import Pagination from "../../../components/Pagination/Pagination";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";
import { Select } from "../../../components/ui";
import { ARRAY_10 } from "../../../utils/Constants";

type LeadStatus = "abandoned" | "recovered" | "all";

interface ICheckoutFilters {
  page: number;
  limit: number;
  status: LeadStatus;
  days: number;
  search: string;
}

interface CheckoutLeadItem {
  id: number;
  userId: number;
  username: string;
  email: string;
  phone: string | null;
  userActive: boolean;
  lastCheckoutDate: string | null;
  lastPaidDate: string | null;
  lastPaidMethod: string | null;
  lastPaidAmount: number | null;
  hoursSinceCheckout: number;
  paidAfterCheckout: boolean;
  leadStatus: "abandoned" | "recovered";
}

interface CheckoutLeadSummary {
  totalCandidates: number;
  abandoned: number;
  recovered: number;
  showing: number;
}

interface CheckoutLeadsResponse {
  page: number;
  limit: number;
  total: number;
  status: LeadStatus;
  range: {
    days: number;
  };
  summary: CheckoutLeadSummary;
  items: CheckoutLeadItem[];
}

const DEFAULT_SUMMARY: CheckoutLeadSummary = {
  totalCandidates: 0,
  abandoned: 0,
  recovered: 0,
  showing: 0,
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  abandoned: "Abandonados",
  recovered: "Recuperados",
  all: "Todos",
};

const DATE_RANGE_OPTIONS = [
  { value: 7, label: "7 días" },
  { value: 14, label: "14 días" },
  { value: 30, label: "30 días" },
  { value: 60, label: "60 días" },
  { value: 90, label: "90 días" },
  { value: 180, label: "180 días" },
  { value: 365, label: "365 días" },
];

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDateShort(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
  }).format(date);
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "—";
  const normalized = method.trim().toLowerCase();
  const map: Record<string, string> = {
    stripe: "Stripe",
    paypal: "PayPal",
    conekta: "Conekta",
    spei: "SPEI",
    cash: "Efectivo",
    card: "Tarjeta",
  };
  return map[normalized] ?? method;
}

function getLeadStatusLabel(status: "abandoned" | "recovered"): string {
  return status === "abandoned" ? "Sin pago desde checkout" : "Pagó después del checkout";
}

export const HistoryCheckout = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [history, setHistory] = useState<CheckoutLeadItem[]>([]);
  const [summary, setSummary] = useState<CheckoutLeadSummary>(DEFAULT_SUMMARY);
  const [totalLoader, setTotalLoader] = useState<boolean>(false);
  const [totalHistory, setTotalHistory] = useState(0);
  const [loader, setLoader] = useState<boolean>(true);
  const [filters, setFilters] = useState<ICheckoutFilters>({
    page: 0,
    limit: 100,
    status: "abandoned",
    days: 30,
    search: "",
  });
  const [drawerItem, setDrawerItem] = useState<CheckoutLeadItem | null>(null);

  const fetchHistory = async (filt: ICheckoutFilters) => {
    setLoader(true);
    setTotalLoader(true);
    try {
      const response = (await trpc.checkoutLogs.getCheckoutLeads.query({
        page: filt.page,
        limit: filt.limit,
        status: filt.status,
        days: filt.days,
        search: filt.search.trim() || undefined,
      })) as CheckoutLeadsResponse;

      setHistory(Array.isArray(response?.items) ? response.items : []);
      setSummary(response?.summary ?? DEFAULT_SUMMARY);
      setTotalHistory(response?.total ?? 0);
    } catch {
      if (import.meta.env.DEV) {
        console.warn("[ADMIN][CHECKOUT_HISTORY] Failed to load checkout lead history.");
      }
      setHistory([]);
      setSummary(DEFAULT_SUMMARY);
      setTotalHistory(0);
    } finally {
      setLoader(false);
      setTotalLoader(false);
    }
  };

  const startFilter = (key: string, value: string | number) => {
    const next = { ...filters, [key]: value };
    if (key !== "page") next.page = 0;
    setFilters(next as ICheckoutFilters);
    void fetchHistory(next as ICheckoutFilters);
  };

  const transformHistoryData = async () => {
    try {
      const tempHistory = (await trpc.checkoutLogs.getCheckoutLeads.query({
        page: 0,
        limit: 5000,
        status: filters.status,
        days: filters.days,
        search: filters.search.trim() || undefined,
      })) as CheckoutLeadsResponse;

      return (tempHistory?.items || []).map((item) => ({
        Usuario: item.username || "—",
        Correo: item.email || "—",
        Teléfono: item.phone || "—",
        "Último checkout": formatDateTime(item.lastCheckoutDate),
        "Último pago": formatDateTime(item.lastPaidDate),
        Estado: getLeadStatusLabel(item.leadStatus),
        Método: formatPaymentMethod(item.lastPaidMethod),
        "Horas desde checkout": String(item.hoursSinceCheckout),
      }));
    } catch {
      if (import.meta.env.DEV) {
        console.warn("[ADMIN][CHECKOUT_HISTORY] Failed to export checkout lead history.");
      }
      return [];
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") navigate("/");
  }, [currentUser, navigate]);

  useEffect(() => {
    void fetchHistory(filters);
  }, []);

  const toolbar = (
    <div className="flex flex-wrap items-end gap-2 w-full">
      <label className="inline-flex flex-col gap-1 text-sm text-text-muted">
        Estado
        <Select
          value={filters.status}
          onChange={(e) => startFilter("status", e.target.value as LeadStatus)}
        >
          <option value="abandoned">Abandonados</option>
          <option value="recovered">Recuperados</option>
          <option value="all">Todos</option>
        </Select>
      </label>
      <label className="inline-flex flex-col gap-1 text-sm text-text-muted">
        Ventana
        <Select
          value={filters.days}
          onChange={(e) => startFilter("days", +e.target.value)}
        >
          {DATE_RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[220px] flex-1">
        Buscar
        <input
          type="text"
          value={filters.search}
          onChange={(e) => startFilter("search", e.target.value)}
          placeholder="email, usuario o teléfono"
          className="min-h-[44px] rounded-xl px-3 border border-border bg-bg-card text-text-main"
        />
      </label>
      <label className="inline-flex flex-col gap-1 text-sm text-text-muted">
        Por página
        <Select
          value={filters.limit}
          onChange={(e) => startFilter("limit", +e.target.value)}
        >
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
        </Select>
      </label>
      <CsvDownloader
        filename="checkout_leads"
        extension=".csv"
        separator=";"
        wrapColumnChar=""
        datas={transformHistoryData}
        text=""
      >
        <span className="inline-flex items-center gap-2 bg-bear-gradient text-bear-dark-500 hover:opacity-95 font-medium rounded-pill px-4 py-2 transition-colors">
          <Download size={18} aria-hidden />
          Exportar
        </span>
      </CsvDownloader>
    </div>
  );

  return (
    <AdminPageLayout
      title="Checkout abandonado"
      subtitle="Detecta leads sin pago, separa recuperados y prioriza seguimiento con datos accionables."
      toolbar={toolbar}
    >
      <div className="w-full overflow-x-hidden space-y-4">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <article className="rounded-xl border bg-bg-card p-3">
            <p className="text-xs uppercase tracking-wider text-text-muted">Leads en ventana</p>
            <p className="text-2xl font-bold text-text-main">{summary.totalCandidates.toLocaleString("es-MX")}</p>
            <p className="text-xs text-text-muted">Últimos {filters.days} días</p>
          </article>
          <article className="rounded-xl border bg-bg-card p-3">
            <span className="badge badge--tiny badge--danger">Abandonados</span>
            <p className="mt-2 text-2xl font-bold text-text-main">{summary.abandoned.toLocaleString("es-MX")}</p>
            <p className="text-xs text-text-muted">Sin pago después del último checkout</p>
          </article>
          <article className="rounded-xl border bg-bg-card p-3">
            <span className="badge badge--tiny badge--success">Recuperados</span>
            <p className="mt-2 text-2xl font-bold text-text-main">{summary.recovered.toLocaleString("es-MX")}</p>
            <p className="text-xs text-text-muted">Pagaron después del último checkout</p>
          </article>
        </section>

        <div className="rounded-xl border bg-bg-card p-3">
          <p className="text-sm text-text-muted">
            Vista actual: <strong>{STATUS_LABELS[filters.status]}</strong> · Mostrando{" "}
            <strong>{summary.showing.toLocaleString("es-MX")}</strong> de{" "}
            <strong>{totalHistory.toLocaleString("es-MX")}</strong> registros.
          </p>
        </div>

        <div className="admin-table-panel">
          <div
            className="overflow-x-auto max-h-[60vh] overflow-y-auto"
            tabIndex={0}
            role="region"
            aria-label="Leads de checkout (tabla desplazable)"
            data-scroll-region
          >
            <table className="w-full table-fixed">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="uppercase text-xs tracking-wider text-left py-3 px-4 w-[260px]">Usuario</th>
                  <th className="uppercase text-xs tracking-wider text-left py-3 px-4 w-[150px]">Teléfono</th>
                  <th className="uppercase text-xs tracking-wider text-left py-3 px-4 w-[170px]">Último checkout</th>
                  <th className="uppercase text-xs tracking-wider text-left py-3 px-4 w-[170px]">Último pago</th>
                  <th className="uppercase text-xs tracking-wider text-left py-3 px-4 w-[140px]">Método</th>
                  <th className="uppercase text-xs tracking-wider text-left py-3 px-4 w-[200px]">Estado lead</th>
                </tr>
              </thead>
              <tbody>
                {!loader
                  ? history.length > 0
                    ? history.map((his) => (
                        <tr key={`ch_${his.id}`} className="border-b transition-colors">
                          <td className="py-3 px-4 text-sm min-w-[260px]">
                            <p className="font-semibold truncate" title={his.email}>
                              {his.email}
                            </p>
                            <p className="text-xs text-text-muted truncate" title={his.username ? `@${his.username}` : ""}>
                              @{his.username || "—"} · ID {his.userId}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-sm truncate" title={his.phone ?? ""}>{his.phone || "—"}</td>
                          <td className="py-3 px-4 text-sm">
                            <p>{formatDateTime(his.lastCheckoutDate)}</p>
                            <p className="text-xs text-text-muted">hace {his.hoursSinceCheckout} h</p>
                          </td>
                          <td className="py-3 px-4 text-sm">{formatDateTime(his.lastPaidDate)}</td>
                          <td className="py-3 px-4 text-sm">
                            {formatPaymentMethod(his.lastPaidMethod)}
                            <p className="text-xs text-text-muted">{formatCurrency(his.lastPaidAmount)}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={[
                                "badge",
                                "badge--tiny",
                                his.leadStatus === "abandoned" ? "badge--danger" : "badge--success",
                              ].join(" ")}
                            >
                              {getLeadStatusLabel(his.leadStatus)}
                            </span>
                          </td>
                        </tr>
                      ))
                    : (
                        <tr>
                          <td colSpan={6} className="py-10 px-4 text-center text-sm text-text-muted">
                            No hay leads para este filtro.
                          </td>
                        </tr>
                      )
                  : ARRAY_10.map((_, i) => (
                      <tr key={`s_${i}`} className="border-b">
                        <td colSpan={6} className="py-4 animate-pulse bg-bg-input" />
                      </tr>
                    ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="p-4">
                    <Pagination
                      totalLoader={totalLoader}
                      totalData={totalHistory}
                      title="Leads"
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

        <div className="admin-mobile-list">
          {!loader
            ? history.length > 0
              ? history.map((his) => {
                  const avatar = (his.email || his.username || "L").trim().charAt(0).toUpperCase();
                  const statusClass = his.leadStatus === "abandoned" ? "is-blocked" : "is-active";
                  const statusLabel = his.leadStatus === "abandoned" ? "Abandonado" : "Recuperado";
                  return (
                    <button
                      key={`m_${his.id}`}
                      className="admin-mobile-card"
                      onClick={() => setDrawerItem(his)}
                      type="button"
                    >
                      <div className="admin-mobile-card__head">
                        <div className="admin-mobile-card__identity">
                          <div className="admin-mobile-card__avatar">{avatar}</div>
                          <div className="admin-mobile-card__copy">
                            <p className="admin-mobile-card__name">{his.email}</p>
                            <p className="admin-mobile-card__email">@{his.username || "—"} · ID {his.userId}</p>
                          </div>
                        </div>
                        <span className={`admin-mobile-status ${statusClass}`}>{statusLabel}</span>
                        <span className="admin-mobile-card__menu" aria-hidden>
                          <MoreVertical size={20} />
                        </span>
                      </div>
                      <div className="admin-mobile-card__foot">
                        <span>Checkout: {formatDateShort(his.lastCheckoutDate)}</span>
                        <span>hace {his.hoursSinceCheckout} h</span>
                        <span>Pago: {formatDateShort(his.lastPaidDate)}</span>
                      </div>
                    </button>
                  );
                })
              : (
                  <div className="admin-mobile-empty">
                    <h2>No hay leads</h2>
                    <p>Prueba cambiar el estado o la ventana de días.</p>
                  </div>
                )
            : ARRAY_10.map((_, i) => (
                <div key={`sm_${i}`} className="admin-mobile-card admin-mobile-card--skeleton">
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
        </div>

        <div className="admin-pagination-mobile mt-4">
          <Pagination
            totalLoader={totalLoader}
            totalData={totalHistory}
            title="Leads"
            startFilter={startFilter}
            currentPage={filters.page}
            limit={filters.limit}
          />
        </div>
      </div>

      <AdminDrawer open={drawerItem !== null} onClose={() => setDrawerItem(null)} title={drawerItem?.email ?? "Lead checkout"} user={undefined}>
        {drawerItem && (
          <div className="space-y-2 text-sm">
            <p><span className="text-text-muted">Usuario:</span> @{drawerItem.username || "—"} (ID {drawerItem.userId})</p>
            <p><span className="text-text-muted">Email:</span> {drawerItem.email}</p>
            <p><span className="text-text-muted">Teléfono:</span> {drawerItem.phone || "—"}</p>
            <p><span className="text-text-muted">Último checkout:</span> {formatDateTime(drawerItem.lastCheckoutDate)}</p>
            <p><span className="text-text-muted">Horas desde checkout:</span> {drawerItem.hoursSinceCheckout}</p>
            <p><span className="text-text-muted">Último pago:</span> {formatDateTime(drawerItem.lastPaidDate)}</p>
            <p><span className="text-text-muted">Método:</span> {formatPaymentMethod(drawerItem.lastPaidMethod)}</p>
            <p><span className="text-text-muted">Monto último pago:</span> {formatCurrency(drawerItem.lastPaidAmount)}</p>
            <p><span className="text-text-muted">Estado del lead:</span> {getLeadStatusLabel(drawerItem.leadStatus)}</p>
            <p><span className="text-text-muted">Estado cuenta:</span> {drawerItem.userActive ? "Activa" : "Inactiva"}</p>
          </div>
        )}
      </AdminDrawer>
    </AdminPageLayout>
  );
};
