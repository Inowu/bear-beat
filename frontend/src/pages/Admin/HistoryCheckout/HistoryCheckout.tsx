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
    } catch (error) {
      console.log(error);
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
    } catch (error) {
      console.log(error);
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
      <label className="inline-flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
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
      <label className="inline-flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
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
      <label className="inline-flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300 min-w-[220px] flex-1">
        Buscar
        <input
          type="text"
          value={filters.search}
          onChange={(e) => startFilter("search", e.target.value)}
          placeholder="email, usuario o teléfono"
          className="min-h-[44px] rounded-xl px-3 border border-gray-300 dark:border-bear-dark-100 bg-transparent"
        />
      </label>
      <label className="inline-flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
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
          <article className="rounded-xl border border-gray-200 dark:border-bear-dark-100 p-3 bg-bear-light-100 dark:bg-bear-dark-500/40">
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Leads en ventana</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-200">{summary.totalCandidates.toLocaleString("es-MX")}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Últimos {filters.days} días</p>
          </article>
          <article className="rounded-xl border border-red-300/40 dark:border-red-400/30 p-3 bg-red-50/40 dark:bg-red-500/10">
            <p className="text-xs uppercase tracking-wider text-red-700 dark:text-red-300">Abandonados</p>
            <p className="text-2xl font-bold text-red-800 dark:text-red-200">{summary.abandoned.toLocaleString("es-MX")}</p>
            <p className="text-xs text-red-700/80 dark:text-red-300/80">Sin pago después del último checkout</p>
          </article>
          <article className="rounded-xl border border-emerald-300/40 dark:border-emerald-400/30 p-3 bg-emerald-50/40 dark:bg-emerald-500/10">
            <p className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Recuperados</p>
            <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{summary.recovered.toLocaleString("es-MX")}</p>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">Pagaron después del último checkout</p>
          </article>
        </section>

        <div className="rounded-xl border border-gray-200 dark:border-bear-dark-100 p-3 bg-bear-light-100 dark:bg-bear-dark-500/40">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Vista actual: <strong>{STATUS_LABELS[filters.status]}</strong> · Mostrando{" "}
            <strong>{summary.showing.toLocaleString("es-MX")}</strong> de{" "}
            <strong>{totalHistory.toLocaleString("es-MX")}</strong> registros.
          </p>
        </div>

        <div className="hidden md:block rounded-xl border border-gray-200 dark:border-bear-dark-100 overflow-hidden">
          <div
            className="overflow-x-auto max-h-[60vh] overflow-y-auto"
            tabIndex={0}
            role="region"
            aria-label="Leads de checkout (tabla desplazable)"
            data-scroll-region
          >
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100">Usuario</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100">Teléfono</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100">Último checkout</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100">Último pago</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100">Método</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100">Estado lead</th>
                </tr>
              </thead>
              <tbody className="bg-bear-light-100 dark:bg-bear-dark-900 divide-y divide-gray-200 dark:divide-bear-dark-100">
                {!loader
                  ? history.map((his) => (
                      <tr key={`ch_${his.id}`} className="border-b border-gray-200 dark:border-bear-dark-100 hover:bg-gray-100 dark:hover:bg-bear-dark-500/50 transition-colors">
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300">
                          <p className="font-semibold">{his.email}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            @{his.username || "—"} · ID {his.userId}
                          </p>
                        </td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300">{his.phone || "—"}</td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300">
                          <p>{formatDateTime(his.lastCheckoutDate)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">hace {his.hoursSinceCheckout} h</p>
                        </td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300">{formatDateTime(his.lastPaidDate)}</td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300">
                          {formatPaymentMethod(his.lastPaidMethod)}
                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(his.lastPaidAmount)}</p>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex text-xs px-2 py-1 rounded-full ${
                              his.leadStatus === "abandoned"
                                ? "bg-red-500/10 text-red-500 dark:text-red-300"
                                : "bg-emerald-500/10 text-emerald-500 dark:text-emerald-300"
                            }`}
                          >
                            {getLeadStatusLabel(his.leadStatus)}
                          </span>
                        </td>
                      </tr>
                    ))
                  : ARRAY_10.map((_, i) => (
                      <tr key={`s_${i}`} className="border-b border-gray-200 dark:border-bear-dark-100">
                        <td colSpan={6} className="py-4 px-4 animate-pulse bg-gray-200 dark:bg-bear-dark-100/50" />
                      </tr>
                    ))}
              </tbody>
              <tfoot className="bg-bear-light-100 dark:bg-bear-dark-500 border-t border-gray-200 dark:border-bear-dark-100">
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

        <div className="block md:hidden grid grid-cols-1 gap-4 w-full">
          {!loader
            ? history.map((his) => (
                <button
                  key={`m_${his.id}`}
                  className="bg-bear-light-100 dark:bg-bear-dark-500 p-4 rounded-lg border border-gray-200 dark:border-bear-dark-100"
                  onClick={() => setDrawerItem(his)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">{his.email}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Checkout: {formatDateTime(his.lastCheckoutDate)}
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 text-[11px] px-2 py-1 rounded-full ${
                        his.leadStatus === "abandoned"
                          ? "bg-red-500/10 text-red-500 dark:text-red-300"
                          : "bg-emerald-500/10 text-emerald-500 dark:text-emerald-300"
                      }`}
                    >
                      {his.leadStatus === "abandoned" ? "Abandonado" : "Recuperado"}
                    </span>
                    <span className="flex-shrink-0 text-gray-500 dark:text-gray-400" aria-hidden>
                      <MoreVertical size={20} />
                    </span>
                  </div>
                </button>
              ))
            : ARRAY_10.map((_, i) => (
                <div key={`sm_${i}`} className="bg-bear-light-100 dark:bg-bear-dark-500 p-4 rounded-lg border border-gray-200 dark:border-bear-dark-100 animate-pulse">
                  <div className="h-12 bg-gray-200 dark:bg-bear-dark-100/50 rounded" />
                </div>
              ))}
        </div>

        <div className="md:hidden mt-4">
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
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p><span className="text-gray-500">Usuario:</span> @{drawerItem.username || "—"} (ID {drawerItem.userId})</p>
            <p><span className="text-gray-500">Email:</span> {drawerItem.email}</p>
            <p><span className="text-gray-500">Teléfono:</span> {drawerItem.phone || "—"}</p>
            <p><span className="text-gray-500">Último checkout:</span> {formatDateTime(drawerItem.lastCheckoutDate)}</p>
            <p><span className="text-gray-500">Horas desde checkout:</span> {drawerItem.hoursSinceCheckout}</p>
            <p><span className="text-gray-500">Último pago:</span> {formatDateTime(drawerItem.lastPaidDate)}</p>
            <p><span className="text-gray-500">Método:</span> {formatPaymentMethod(drawerItem.lastPaidMethod)}</p>
            <p><span className="text-gray-500">Monto último pago:</span> {formatCurrency(drawerItem.lastPaidAmount)}</p>
            <p><span className="text-gray-500">Estado del lead:</span> {getLeadStatusLabel(drawerItem.leadStatus)}</p>
            <p><span className="text-gray-500">Estado cuenta:</span> {drawerItem.userActive ? "Activa" : "Inactiva"}</p>
          </div>
        )}
      </AdminDrawer>
    </AdminPageLayout>
  );
};
