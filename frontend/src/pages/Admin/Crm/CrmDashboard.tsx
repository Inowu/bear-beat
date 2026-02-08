import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clock,
  DollarSign,
  RefreshCw,
  Repeat,
  UserPlus,
  Users,
} from "lucide-react";
import trpc from "../../../api";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { Spinner } from "../../../components/Spinner/Spinner";
import "./CrmDashboard.scss";

interface CrmDailyRegistrationPoint {
  day: string;
  registrations: number;
  cumulative: number;
}

interface CrmDailyTrialPoint {
  day: string;
  trialStarts: number;
  trialConversions: number;
}

interface CrmCancellationReasonPoint {
  reasonCode: string;
  cancellations: number;
}

interface CrmPaidNoDownloadPoint {
  userId: number;
  username: string;
  paidAt: string;
  planId: number | null;
  paymentMethod: string | null;
}

interface CrmSnapshot {
  range: {
    days: number;
    start: string;
    end: string;
  };
  kpis: {
    totalUsers: number;
    registrations: number;
    paidOrders: number;
    newPaidUsers: number;
    renewalOrders: number;
    grossRevenue: number;
    avgOrderValue: number;
    trialStarts: number;
    trialConversions: number;
    trialConversionRatePct: number;
    cancellations: number;
    avgHoursPaidToFirstDownload: number | null;
  };
  registrationsDaily: CrmDailyRegistrationPoint[];
  trialsDaily: CrmDailyTrialPoint[];
  cancellationTopReasons: CrmCancellationReasonPoint[];
  paidNoDownload24h: CrmPaidNoDownloadPoint[];
}

const RANGE_OPTIONS = [7, 14, 30, 60, 90, 120];

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatDecimal(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function KpiCard(props: {
  title: string;
  value: string;
  helper?: string;
  icon: any;
}) {
  const { title, value, helper, icon: Icon } = props;
  return (
    <div className="crm-kpi-card">
      <div className="crm-kpi-card__top">
        <span className="crm-kpi-card__icon" aria-hidden>
          <Icon />
        </span>
        <span className="crm-kpi-card__title">{title}</span>
      </div>
      <div className="crm-kpi-card__value">{value}</div>
      {helper ? <div className="crm-kpi-card__helper">{helper}</div> : null}
    </div>
  );
}

export function CrmDashboard() {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [snapshot, setSnapshot] = useState<CrmSnapshot | null>(null);

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data: CrmSnapshot = await trpc.analytics.getAnalyticsCrmDashboard.query({
        days: rangeDays,
        limit: 80,
      });
      setSnapshot(data);
    } catch {
      setError("No se pudo cargar el CRM. Intenta de nuevo.");
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, refresh]);

  const rangeLabel = useMemo(() => {
    if (!snapshot) return "";
    return `${snapshot.range.start} → ${snapshot.range.end}`;
  }, [snapshot]);

  return (
    <AdminPageLayout
      title="CRM"
      toolbar={
        <div className="crm-toolbar">
          <div className="crm-toolbar__group">
            <label className="crm-toolbar__label">
              Rango
              <select
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
              >
                {RANGE_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} días
                  </option>
                ))}
              </select>
            </label>
            <label className="crm-toolbar__toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Actualizar en vivo
            </label>
          </div>
          <div className="crm-toolbar__group">
            <button type="button" className="crm-toolbar__btn" onClick={() => void refresh()}>
              <RefreshCw size={18} aria-hidden />
              Refrescar
            </button>
          </div>
        </div>
      }
    >
      {loading && !snapshot ? (
        <div className="crm-state">
          <Spinner size={3} width={0.3} color="var(--ad-accent)" />
          <p>Cargando CRM…</p>
        </div>
      ) : error ? (
        <div className="crm-state crm-state--error" role="alert">
          <p>{error}</p>
          <button type="button" className="crm-toolbar__btn" onClick={() => void refresh()}>
            <RefreshCw size={18} aria-hidden />
            Reintentar
          </button>
        </div>
      ) : snapshot ? (
        <div className="crm-wrap">
          <p className="crm-range">{rangeLabel}</p>

          <div className="crm-kpi-grid" role="list" aria-label="KPIs principales">
            <KpiCard
              title="Usuarios totales"
              value={formatCompactNumber(snapshot.kpis.totalUsers)}
              helper="Histórico"
              icon={Users}
            />
            <KpiCard
              title="Registros"
              value={formatCompactNumber(snapshot.kpis.registrations)}
              helper={`Últimos ${snapshot.range.days} días`}
              icon={UserPlus}
            />
            <KpiCard
              title="Órdenes pagadas"
              value={formatCompactNumber(snapshot.kpis.paidOrders)}
              helper={`${formatCompactNumber(snapshot.kpis.renewalOrders)} renovaciones`}
              icon={Repeat}
            />
            <KpiCard
              title="Usuarios nuevos (pago)"
              value={formatCompactNumber(snapshot.kpis.newPaidUsers)}
              helper="Primera compra en el rango"
              icon={Activity}
            />
            <KpiCard
              title="Ingresos"
              value={formatCurrency(snapshot.kpis.grossRevenue)}
              helper={`AOV ${formatCurrency(snapshot.kpis.avgOrderValue)}`}
              icon={DollarSign}
            />
            <KpiCard
              title="Trial"
              value={`${formatCompactNumber(snapshot.kpis.trialStarts)} → ${formatCompactNumber(
                snapshot.kpis.trialConversions,
              )}`}
              helper={`Conversión ${formatPct(snapshot.kpis.trialConversionRatePct)}`}
              icon={Clock}
            />
          </div>

          <section className="crm-section">
            <h2 className="crm-section__title">Registros diarios (acumulado)</h2>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Registros</th>
                    <th>Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.registrationsDaily.slice(-14).map((row) => (
                    <tr key={row.day}>
                      <td>{row.day}</td>
                      <td>{row.registrations}</td>
                      <td>{row.cumulative}</td>
                    </tr>
                  ))}
                  {snapshot.registrationsDaily.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="crm-table__empty">
                        Sin datos en este rango.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="crm-section">
            <h2 className="crm-section__title">Trial por día</h2>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Inicios</th>
                    <th>Conversiones</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.trialsDaily.slice(-14).map((row) => (
                    <tr key={row.day}>
                      <td>{row.day}</td>
                      <td>{row.trialStarts}</td>
                      <td>{row.trialConversions}</td>
                    </tr>
                  ))}
                  {snapshot.trialsDaily.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="crm-table__empty">
                        Aún no hay eventos de trial.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="crm-section">
            <h2 className="crm-section__title">Cancelaciones (razones principales)</h2>
            <p className="crm-section__hint">
              Total en el rango: <strong>{snapshot.kpis.cancellations}</strong>
            </p>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Razón</th>
                    <th>Cancelaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.cancellationTopReasons.map((row) => (
                    <tr key={row.reasonCode}>
                      <td>{row.reasonCode}</td>
                      <td>{row.cancellations}</td>
                    </tr>
                  ))}
                  {snapshot.cancellationTopReasons.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="crm-table__empty">
                        Sin datos en este rango.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="crm-section">
            <h2 className="crm-section__title">Activación (primer download)</h2>
            <p className="crm-section__hint">
              Promedio horas desde primer pago a primer download:{" "}
              <strong>{formatDecimal(snapshot.kpis.avgHoursPaidToFirstDownload, 2)}</strong>
            </p>
          </section>

          <section className="crm-section">
            <h2 className="crm-section__title">Pagaron y no descargaron en 24h</h2>
            <p className="crm-section__hint">
              Lista enfocada en primeras compras dentro del rango.
            </p>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Usuario</th>
                    <th>Pagó</th>
                    <th>Plan</th>
                    <th>Método</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.paidNoDownload24h.map((row) => (
                    <tr key={`${row.userId}-${row.paidAt}`}>
                      <td>{row.userId}</td>
                      <td>{row.username}</td>
                      <td>{row.paidAt}</td>
                      <td>{row.planId ?? "—"}</td>
                      <td>{row.paymentMethod ?? "—"}</td>
                    </tr>
                  ))}
                  {snapshot.paidNoDownload24h.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="crm-table__empty">
                        Todo bien: no hay usuarios en este segmento.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </AdminPageLayout>
  );
}

