import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AddInstructionsModal } from "../../../components/Modals";
import { ARRAY_10 } from "../../../utils/Constants";
import { IAdminDownloadHistory } from "../../../interfaces/admin";
import Pagination from "../../../components/Pagination/Pagination";
import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";
import { Plus, MoreVertical, RefreshCw, AlertTriangle } from "src/icons";
import { Select, SkeletonRow } from "../../../components/ui";

interface IAdminFilter {
  page: number;
  limit: number;
}

type DownloadHistoryViewMode = "history" | "consumption";

interface DownloadConsumptionTotals {
  downloads: number;
  totalBytes: number;
  totalGb: number;
  uniqueUsers: number;
}

interface DownloadConsumptionTopUserRow {
  userId: number;
  username: string;
  email: string;
  phone: string | null;
  downloads: number;
  totalBytes: number;
  totalGb: number;
  lastDownload: string | null;
}

interface DownloadConsumptionUserDayRow {
  userId: number;
  username: string;
  email: string;
  phone: string | null;
  day: string;
  downloads: number;
  totalBytes: number;
  totalGb: number;
}

interface DownloadConsumptionAlertRow extends DownloadConsumptionUserDayRow {
  thresholdGbPerDay: number;
}

interface DownloadConsumptionSnapshot {
  range: { days: number; start: string; end: string };
  thresholdGbPerDay: number;
  totals: DownloadConsumptionTotals;
  topUsers: DownloadConsumptionTopUserRow[];
  topUserDays: DownloadConsumptionUserDayRow[];
  alerts: DownloadConsumptionAlertRow[];
}

const formatDownloadSize = (rawSize: bigint | number | string) => {
  const bytes = Number(rawSize ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0.00 GB";
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatGb = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)} GB`;
};

const formatIsoDay = (value: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  const stableDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(stableDate);
};

export const DownloadHistory = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<DownloadHistoryViewMode>("history");
  const [history, setHistory] = useState<IAdminDownloadHistory[]>([]);
  const [totalLoader, setTotalLoader] = useState<boolean>(false);
  const [totalHistory, setTotalHistory] = useState(0);
  const [loader, setLoader] = useState<boolean>(true);
  const [filters, setFilters] = useState<IAdminFilter>({ page: 0, limit: 50 });
  const [showModal, setShowModal] = useState<boolean>(false);
  const [videoURL, setVideoURL] = useState<string>("");
  const [videoId, setVideoId] = useState<number>(0);
  const [drawerItem, setDrawerItem] = useState<IAdminDownloadHistory | null>(null);

  const [consumptionDays, setConsumptionDays] = useState<number>(7);
  const [consumptionThresholdGb, setConsumptionThresholdGb] = useState<number>(20);
  const [consumption, setConsumption] = useState<DownloadConsumptionSnapshot | null>(null);
  const [consumptionLoading, setConsumptionLoading] = useState<boolean>(false);
  const [consumptionError, setConsumptionError] = useState<string>("");

  const startFilter = (key: string, value: string | number) => {
    const next = { ...filters, [key]: value };
    if (key !== "page") next.page = 0;
    setFilters(next);
  };

  const filterHistory = async (filt: IAdminFilter) => {
    setLoader(true);
    setTotalLoader(true);
    try {
      const res = await trpc.downloadHistory.getDownloadHistory.query({
        take: filt.limit,
        skip: filt.page * filt.limit,
        orderBy: { date: "desc" },
      });
      setHistory(res.data);
      setTotalHistory(res.count);
    } catch {
      if (import.meta.env.DEV) {
        console.warn("[ADMIN][DOWNLOAD_HISTORY] Failed to load download history.");
      }
    } finally {
      setLoader(false);
      setTotalLoader(false);
    }
  };

  const fetchConsumption = async () => {
    setConsumptionLoading(true);
    setConsumptionError("");
    try {
      const snapshot = (await trpc.downloadHistory.getDownloadConsumptionDashboard.query({
        days: consumptionDays,
        limitUsers: 50,
        limitUserDays: 150,
        abuseGbPerDayThreshold: consumptionThresholdGb,
      })) as DownloadConsumptionSnapshot;
      setConsumption(snapshot);
    } catch {
      setConsumption(null);
      setConsumptionError("No se pudo cargar el dashboard de consumo. Intenta nuevamente.");
    } finally {
      setConsumptionLoading(false);
    }
  };

  const getConfig = async () => {
    try {
      const c = await trpc.config.findFirstConfig.query({ where: { name: "videoURL" } });
      if (c) {
        setVideoURL(c.value);
        setVideoId(c.id);
      }
    } catch {
      if (import.meta.env.DEV) {
        console.warn("[ADMIN][DOWNLOAD_HISTORY] Failed to load config videoURL.");
      }
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") navigate("/");
  }, [currentUser, navigate]);

  useEffect(() => {
    if (viewMode !== "history") return;
    void filterHistory(filters);
  }, [filters, viewMode]);

  useEffect(() => {
    void getConfig();
  }, []);

  useEffect(() => {
    if (viewMode !== "consumption") return;
    void fetchConsumption();
  }, [viewMode]);

  const toolbar = (
    <div className="flex flex-wrap items-end gap-2 w-full" data-testid="downloads-history-toolbar">
      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[200px]">
        Vista
        <Select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as DownloadHistoryViewMode)}
        >
          <option value="history">Historial</option>
          <option value="consumption">Consumo</option>
        </Select>
      </label>

      {viewMode === "history" ? (
        <>
          <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[160px]">
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
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-bear-gradient hover:opacity-95 text-bear-dark-500 font-medium rounded-pill px-4 py-2 transition-opacity"
          >
            <Plus size={18} />
            Añadir instrucciones
          </button>
        </>
      ) : (
        <>
          <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[140px]">
            Rango
            <Select value={consumptionDays} onChange={(e) => setConsumptionDays(Number(e.target.value))}>
              <option value={1}>24 horas</option>
              <option value={7}>7 días</option>
              <option value={14}>14 días</option>
              <option value={30}>30 días</option>
              <option value={60}>60 días</option>
              <option value={90}>90 días</option>
            </Select>
          </label>
          <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[160px]">
            Umbral GB/día
            <input
              type="number"
              min={0}
              step={1}
              value={consumptionThresholdGb}
              onChange={(e) => setConsumptionThresholdGb(Number(e.target.value))}
              className="bg-bg-card border border-border rounded-lg px-3 py-2 text-text-main"
            />
          </label>
          <button
            type="button"
            onClick={() => fetchConsumption()}
            disabled={consumptionLoading}
            aria-label={consumptionLoading ? "Actualizando consumo por usuario" : undefined}
            className="inline-flex items-center gap-2 bg-bg-card hover:bg-bg-input text-text-main font-medium rounded-pill px-4 py-2 border border-border transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} />
            {consumptionLoading ? <SkeletonRow width="78px" height="14px" /> : "Actualizar"}
          </button>
        </>
      )}
    </div>
  );

  return (
    <AdminPageLayout
      title="Historial de descargas"
      subtitle="Monitorea qué se descarga, cuándo y por quién para resolver fricción operativa rápido."
      toolbar={toolbar}
    >
      {viewMode === "history" ? (
        <>
          <AddInstructionsModal showModal={showModal} onHideModal={() => setShowModal(false)} videoURL={videoURL} videoId={videoId} />

          <div className="admin-table-panel">
            <div
              className="overflow-x-auto max-h-[60vh] overflow-y-auto"
              tabIndex={0}
              role="region"
              aria-label="Historial de descargas (tabla desplazable)"
              data-scroll-region
            >
              <table className="w-full table-fixed">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="uppercase text-xs tracking-wider text-left py-3 px-4 w-[180px]">Email</th>
                    <th className="uppercase text-xs tracking-wider text-left py-3 px-4 hidden xl:table-cell w-[150px]">Teléfono</th>
                    <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Nombre</th>
                    <th className="uppercase text-xs tracking-wider text-left py-3 px-4 w-[110px]">Tamaño</th>
                    <th className="uppercase text-xs tracking-wider text-left py-3 px-4 w-[120px]">Fecha</th>
                    <th className="uppercase text-xs tracking-wider text-left py-3 px-4 w-[100px]">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {!loader
                    ? history.length > 0
                      ? history.map((his, index) => {
                        const sizeLabel = formatDownloadSize(his.size);
                        return (
                          <tr key={`h_${index}`} className="border-b transition-colors">
                            <td className="py-3 px-4 text-sm truncate" title={his.email}>{his.email}</td>
                            <td className="py-3 px-4 text-sm hidden xl:table-cell truncate" title={his.phone ?? ""}>{his.phone}</td>
                            <td className="py-3 px-4 text-sm truncate" title={his.fileName}>{his.fileName}</td>
                            <td className="py-3 px-4 text-sm">{sizeLabel}</td>
                            <td className="py-3 px-4 text-sm">{his.date.toLocaleDateString()}</td>
                            <td className="py-3 px-4">
                              <span className="badge badge--tiny badge--neutral">
                                {his.isFolder ? "Carpeta" : "Archivo"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                      : (
                        <tr>
                          <td colSpan={6} className="py-10 px-4 text-center text-sm text-text-muted">
                            No hay descargas registradas para este rango.
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
                    <td colSpan={6} className="py-3 px-4">
                      <Pagination
                        totalLoader={totalLoader}
                        totalData={totalHistory}
                        title="Datos"
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
                ? history.map((his, index) => {
                  const sizeLabel = formatDownloadSize(his.size);
                  return (
                    <button
                      key={`m_${index}`}
                      className="admin-mobile-card"
                      onClick={() => setDrawerItem(his)}
                      type="button"
                    >
                      <div className="admin-mobile-card__head">
                        <div className="admin-mobile-card__identity">
                          <div className="admin-mobile-card__avatar">{his.isFolder ? "F" : "A"}</div>
                          <div className="admin-mobile-card__copy">
                            <p className="admin-mobile-card__name">{his.fileName}</p>
                            <p className="admin-mobile-card__email">{his.email}</p>
                          </div>
                        </div>
                        <span className="admin-mobile-status is-active">
                          {his.isFolder ? "Carpeta" : "Archivo"}
                        </span>
                        <span className="admin-mobile-card__menu" aria-hidden>
                          <MoreVertical size={20} />
                        </span>
                      </div>
                      <div className="admin-mobile-card__foot">
                        <span>{sizeLabel}</span>
                        <span>{his.date.toLocaleDateString()}</span>
                        <span>{his.phone || "—"}</span>
                      </div>
                    </button>
                  );
                })
                : (
                  <div className="px-4 py-6 text-center">
                    <p className="text-text-main text-sm font-medium">No hay descargas registradas.</p>
                    <p className="text-text-muted text-xs mt-1">Cuando haya actividad, aparecerá aquí.</p>
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
                  </div>
                ))}
          </div>

          <div className="admin-pagination-mobile">
            <Pagination
              totalLoader={totalLoader}
              totalData={totalHistory}
              title="Datos"
              startFilter={startFilter}
              currentPage={filters.page}
              limit={filters.limit}
            />
          </div>

          <AdminDrawer open={drawerItem !== null} onClose={() => setDrawerItem(null)} title={drawerItem?.fileName ?? "Descarga"} user={undefined}>
            {drawerItem && (
              <div className="space-y-2 text-sm">
                <p><span className="text-text-muted">Email:</span> {drawerItem.email}</p>
                <p><span className="text-text-muted">Teléfono:</span> {drawerItem.phone}</p>
                <p><span className="text-text-muted">Tamaño:</span> {(Number(drawerItem.size) / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
                <p><span className="text-text-muted">Fecha:</span> {drawerItem.date.toLocaleDateString()}</p>
                <p><span className="text-text-muted">Tipo:</span> {drawerItem.isFolder ? "Carpeta" : "Archivo"}</p>
              </div>
            )}
          </AdminDrawer>
        </>
      ) : (
        <div className="flex flex-col gap-6">
          {consumptionError ? (
            <div className="admin-table-panel p-4">
              <p className="text-danger-400 text-sm">{consumptionError}</p>
            </div>
          ) : consumptionLoading && !consumption ? (
            <div className="flex justify-center py-12">
              <RefreshCw size={20} className="animate-spin" />
            </div>
          ) : consumption ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-border bg-bg-card p-4">
                  <h2 className="text-text-muted text-xs uppercase tracking-wider mb-1">GB totales</h2>
                  <p className="text-text-main text-2xl font-bold">{formatGb(consumption.totals.totalGb)}</p>
                </div>
                <div className="rounded-xl border border-border bg-bg-card p-4">
                  <h2 className="text-text-muted text-xs uppercase tracking-wider mb-1">Descargas</h2>
                  <p className="text-text-main text-2xl font-bold">{consumption.totals.downloads.toLocaleString("es-MX")}</p>
                </div>
                <div className="rounded-xl border border-border bg-bg-card p-4">
                  <h2 className="text-text-muted text-xs uppercase tracking-wider mb-1">Usuarios únicos</h2>
                  <p className="text-text-main text-2xl font-bold">{consumption.totals.uniqueUsers.toLocaleString("es-MX")}</p>
                </div>
                <div className="rounded-xl border border-border bg-bg-card p-4">
                  <h2 className="text-text-muted text-xs uppercase tracking-wider mb-1">Umbral alerta</h2>
                  <p className="text-text-main text-2xl font-bold">{formatGb(consumption.thresholdGbPerDay)}</p>
                </div>
              </div>

              {consumption.alerts.length > 0 ? (
                <div className="admin-table-panel">
                  <div className="p-4 flex items-center gap-2">
                    <AlertTriangle size={18} />
                    <div>
                      <p className="text-text-main text-sm font-semibold">Alertas de abuso</p>
                      <p className="text-text-muted text-xs">
                        User-days que exceden {consumption.thresholdGbPerDay} GB/día en el rango.
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[45vh] overflow-y-auto" tabIndex={0} role="region" aria-label="Alertas de consumo" data-scroll-region>
                    <table className="w-full min-w-[900px]">
                      <thead className="sticky top-0 z-10">
                        <tr>
                          <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Día</th>
                          <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Usuario</th>
                          <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Email</th>
                          <th className="uppercase text-xs tracking-wider text-right py-3 px-4">GB</th>
                          <th className="uppercase text-xs tracking-wider text-right py-3 px-4">Descargas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consumption.alerts.map((row) => (
                          <tr key={`a_${row.userId}_${row.day}`} className="border-b transition-colors">
                            <td className="py-3 px-4 text-sm">{formatIsoDay(row.day)}</td>
                            <td className="py-3 px-4 text-sm">{row.username} (#{row.userId})</td>
                            <td className="py-3 px-4 text-sm truncate" title={row.email}>{row.email}</td>
                            <td className="py-3 px-4 text-sm text-right font-medium">{formatGb(row.totalGb)}</td>
                            <td className="py-3 px-4 text-sm text-right">{row.downloads.toLocaleString("es-MX")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="admin-table-panel p-4">
                  <p className="text-text-muted text-sm">Sin alertas de abuso para este umbral y rango.</p>
                </div>
              )}

              <div className="admin-table-panel">
                <div className="p-4">
                  <p className="text-text-main text-sm font-semibold">Top usuarios por consumo</p>
                </div>
                <div className="overflow-x-auto max-h-[45vh] overflow-y-auto" tabIndex={0} role="region" aria-label="Top usuarios" data-scroll-region>
                  <table className="w-full min-w-[900px]">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Usuario</th>
                        <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Email</th>
                        <th className="uppercase text-xs tracking-wider text-right py-3 px-4">GB</th>
                        <th className="uppercase text-xs tracking-wider text-right py-3 px-4">Descargas</th>
                        <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Última descarga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumption.topUsers.map((row) => (
                        <tr key={`u_${row.userId}`} className="border-b transition-colors">
                          <td className="py-3 px-4 text-sm">{row.username} (#{row.userId})</td>
                          <td className="py-3 px-4 text-sm truncate" title={row.email}>{row.email}</td>
                          <td className="py-3 px-4 text-sm text-right font-medium">{formatGb(row.totalGb)}</td>
                          <td className="py-3 px-4 text-sm text-right">{row.downloads.toLocaleString("es-MX")}</td>
                          <td className="py-3 px-4 text-sm">{row.lastDownload ? new Date(row.lastDownload).toLocaleString("es-MX") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-table-panel">
                <div className="p-4">
                  <p className="text-text-main text-sm font-semibold">Top GB por usuario y día</p>
                </div>
                <div className="overflow-x-auto max-h-[45vh] overflow-y-auto" tabIndex={0} role="region" aria-label="Top usuario-día" data-scroll-region>
                  <table className="w-full min-w-[900px]">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Día</th>
                        <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Usuario</th>
                        <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Email</th>
                        <th className="uppercase text-xs tracking-wider text-right py-3 px-4">GB</th>
                        <th className="uppercase text-xs tracking-wider text-right py-3 px-4">Descargas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumption.topUserDays.map((row) => (
                        <tr key={`d_${row.userId}_${row.day}`} className="border-b transition-colors">
                          <td className="py-3 px-4 text-sm">{formatIsoDay(row.day)}</td>
                          <td className="py-3 px-4 text-sm">{row.username} (#{row.userId})</td>
                          <td className="py-3 px-4 text-sm truncate" title={row.email}>{row.email}</td>
                          <td className="py-3 px-4 text-sm text-right font-medium">{formatGb(row.totalGb)}</td>
                          <td className="py-3 px-4 text-sm text-right">{row.downloads.toLocaleString("es-MX")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="admin-table-panel p-4">
              <p className="text-text-muted text-sm">Sin datos aún.</p>
            </div>
          )}
        </div>
      )}
    </AdminPageLayout>
  );
};
