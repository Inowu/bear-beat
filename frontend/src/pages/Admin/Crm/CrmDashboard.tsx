import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clock,
  Database,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Repeat,
  TrendingUp,
  UserPlus,
  Users,
} from "src/icons";
import trpc from "../../../api";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import Pagination from "../../../components/Pagination/Pagination";
import { Spinner } from "../../../components/Spinner/Spinner";
import { Select } from "../../../components/ui";
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

interface CrmTrialNoDownloadPoint {
  userId: number;
  username: string;
  email: string;
  phone: string | null;
  trialStartedAt: string;
  planId: number | null;
}

interface CrmPaidNoDownloadPoint {
  userId: number;
  username: string;
  email: string;
  phone: string | null;
  paidAt: string;
  planId: number | null;
  paymentMethod: string | null;
}

interface CrmRecentCancellationPoint {
  id: number;
  userId: number;
  username: string;
  email: string;
  phone: string | null;
  paymentMethod: string | null;
  createdAt: string;
  reasonCode: string;
  reasonText: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
}

interface AutomationRunRow {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  error: string | null;
}

interface AutomationStatusSnapshot {
  actionsLast24h: number;
  recentRuns: AutomationRunRow[];
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
    involuntaryCancellations: number;
    avgHoursPaidToFirstDownload: number | null;
    medianHoursPaidToFirstDownload: number | null;
    p90HoursPaidToFirstDownload: number | null;
    avgHoursRegisterToFirstPaid: number | null;
  };
  registrationsDaily: CrmDailyRegistrationPoint[];
  trialsDaily: CrmDailyTrialPoint[];
  cancellationTopReasons: CrmCancellationReasonPoint[];
  recentCancellationsTotal: number;
  recentCancellations: CrmRecentCancellationPoint[];
  trialNoDownload24hTotal: number;
  trialNoDownload24h: CrmTrialNoDownloadPoint[];
  paidNoDownload2hTotal: number;
  paidNoDownload2h: CrmPaidNoDownloadPoint[];
  paidNoDownload24hTotal: number;
  paidNoDownload24h: CrmPaidNoDownloadPoint[];
}

const RANGE_OPTIONS = [
  { value: 1, label: "Últimas 24 horas" },
  { value: 7, label: "7 días" },
  { value: 14, label: "14 días" },
  { value: 30, label: "30 días" },
  { value: 60, label: "60 días" },
  { value: 90, label: "90 días" },
  { value: 120, label: "120 días" },
];

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

function formatDateLabel(value: string, withTime = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

function formatDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const stableDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(stableDate);
  }
  return formatDateLabel(value, false);
}

function formatRangeWindow(days: number): string {
  return days <= 1 ? "24 horas" : `${days} días`;
}

function formatRecentWindow(days: number): string {
  return days <= 1 ? "Últimas 24 horas" : `Últimos ${days} días`;
}

function formatReasonCode(reasonCode: string): string {
  const normalized = reasonCode.trim().toLowerCase();
  const alias: Record<string, string> = {
    expensive: "Precio alto",
    too_expensive: "Precio alto",
    no_uso: "No lo usa",
    no_use: "No lo usa",
    no_content: "No encontró contenido",
    payment_issue: "Problema de pago",
    card_declined: "Tarjeta rechazada",
    support: "Mala experiencia de soporte",
  };

  if (alias[normalized]) return alias[normalized];

  return normalized
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatPaymentMethod(method: string | null): string {
  if (!method) return "—";
  const normalized = method.trim().toLowerCase();
  const alias: Record<string, string> = {
    stripe: "Stripe",
    paypal: "PayPal",
    conekta: "Conekta",
    spei: "SPEI",
    card: "Tarjeta",
    cash: "Efectivo",
  };
  return alias[normalized] ?? method;
}

function formatStatus(status: string): string {
  if (!status) return "—";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusTone(status: string): "ok" | "warn" | "error" | "neutral" {
  const normalized = status.toLowerCase();
  if (
    normalized.includes("ok") ||
    normalized.includes("success") ||
    normalized.includes("done") ||
    normalized.includes("completed")
  ) {
    return "ok";
  }
  if (normalized.includes("running") || normalized.includes("process")) {
    return "warn";
  }
  if (normalized.includes("error") || normalized.includes("failed")) {
    return "error";
  }
  return "neutral";
}

function rate(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function KpiCard(props: {
  title: string;
  value: string;
  helper?: string;
  icon: any;
}) {
  const { title, value, helper, icon: Icon } = props;
  return (
    <div className="crm-kpi-card" role="listitem">
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

function SignalCard(props: {
  title: string;
  value: string;
  helper: string;
  tone: "ok" | "warn" | "error";
}) {
  const { title, value, helper, tone } = props;
  return (
    <article className={`crm-signal-card crm-signal-card--${tone}`}>
      <p className="crm-signal-card__title">{title}</p>
      <p className="crm-signal-card__value">{value}</p>
      <p className="crm-signal-card__helper">{helper}</p>
    </article>
  );
}

export function CrmDashboard() {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [snapshot, setSnapshot] = useState<CrmSnapshot | null>(null);
  const [automation, setAutomation] = useState<AutomationStatusSnapshot | null>(
    null,
  );
  const [actionToast, setActionToast] = useState<string>("");
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [recentCancellationsPage, setRecentCancellationsPage] =
    useState<number>(0);
  const [trialNoDownloadPage, setTrialNoDownloadPage] = useState<number>(0);
  const [paidNoDownload2hPage, setPaidNoDownload2hPage] = useState<number>(0);
  const [paidNoDownloadPage, setPaidNoDownloadPage] = useState<number>(0);
  const listLimit = 50;

  const toast = (message: string) => {
    setActionToast(message);
    window.setTimeout(() => setActionToast(""), 3500);
  };

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setActionBusyKey(key);
    try {
      await fn();
      toast("Listo.");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "No se pudo completar la acción.";
      toast(msg);
    } finally {
      setActionBusyKey(null);
    }
  };

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [data, automationStatus] = await Promise.all([
        trpc.analytics.getAnalyticsCrmDashboard.query({
          days: rangeDays,
          limit: listLimit,
          recentCancellationsPage,
          trialNoDownloadPage,
          paidNoDownload2hPage,
          paidNoDownloadPage,
        }) as Promise<CrmSnapshot>,
        trpc.analytics.getAutomationStatus
          .query({ runsLimit: 12 })
          .catch(() => null) as Promise<AutomationStatusSnapshot | null>,
      ]);
      setSnapshot(data);
      setAutomation(automationStatus);
      setLastUpdatedAt(new Date());
    } catch {
      setError("No se pudo cargar el CRM. Intenta de nuevo.");
      setSnapshot(null);
      setAutomation(null);
    } finally {
      setLoading(false);
    }
  }, [
    rangeDays,
    listLimit,
    recentCancellationsPage,
    trialNoDownloadPage,
    paidNoDownload2hPage,
    paidNoDownloadPage,
  ]);

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
    return `${formatDateLabel(snapshot.range.start)} a ${formatDateLabel(snapshot.range.end)} (${formatRangeWindow(snapshot.range.days)})`;
  }, [snapshot]);

  const dataSources = useMemo(
    () => [
      "users",
      "orders",
      "download_history",
      "analytics_events",
      "subscription_cancellation_feedback",
    ],
    [],
  );

  const signals = useMemo(() => {
    if (!snapshot) return [];
    const registrationToPaidPct = rate(
      snapshot.kpis.newPaidUsers,
      snapshot.kpis.registrations,
    );
    const activationRiskTotal =
      snapshot.trialNoDownload24hTotal + snapshot.paidNoDownload24hTotal;
    const cancellationPressurePct = rate(
      snapshot.kpis.cancellations,
      snapshot.kpis.paidOrders,
    );

    return [
      {
        title: "Conversión registro → primer pago",
        value: formatPct(registrationToPaidPct),
        helper: `${snapshot.kpis.newPaidUsers} de ${snapshot.kpis.registrations} registros del rango.`,
        tone:
          registrationToPaidPct >= 15
            ? "ok"
            : registrationToPaidPct >= 8
              ? "warn"
              : "error",
      },
      {
        title: "Riesgo de activación (24h)",
        value: formatCompactNumber(activationRiskTotal),
        helper: `${snapshot.paidNoDownload2hTotal} pagados sin descarga en 2h · ${snapshot.trialNoDownload24hTotal} trial_started + ${snapshot.paidNoDownload24hTotal} pagados en 24h.`,
        tone:
          activationRiskTotal <= 5
            ? "ok"
            : activationRiskTotal <= 20
              ? "warn"
              : "error",
      },
      {
        title: "Presión de cancelación",
        value: formatPct(cancellationPressurePct),
        helper: `${snapshot.kpis.cancellations} cancelaciones vs ${snapshot.kpis.paidOrders} órdenes pagadas.`,
        tone:
          cancellationPressurePct <= 8
            ? "ok"
            : cancellationPressurePct <= 18
              ? "warn"
              : "error",
      },
    ] as const;
  }, [snapshot]);

  const trialEventTotals = useMemo(() => {
    if (!snapshot) {
      return { trialStarts: 0, trialConversions: 0 };
    }
    return snapshot.trialsDaily.reduce(
      (acc, row) => ({
        trialStarts: acc.trialStarts + row.trialStarts,
        trialConversions: acc.trialConversions + row.trialConversions,
      }),
      { trialStarts: 0, trialConversions: 0 },
    );
  }, [snapshot]);

  const updatedAtLabel = useMemo(() => {
    if (!lastUpdatedAt) return "—";
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(lastUpdatedAt);
  }, [lastUpdatedAt]);

  return (
    <AdminPageLayout
      title="CRM"
      subtitle="Orquesta activación, retención y cancelaciones en una sola vista operativa para el equipo."
      toolbar={
        <div className="flex flex-wrap items-end gap-2 w-full">
          <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[180px]">
            Rango
            <Select
              value={rangeDays}
              onChange={(e) => {
                setRangeDays(Number(e.target.value));
                setRecentCancellationsPage(0);
                setTrialNoDownloadPage(0);
                setPaidNoDownload2hPage(0);
                setPaidNoDownloadPage(0);
              }}
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <button
            type="button"
            role="switch"
            aria-checked={autoRefresh}
            onClick={() => setAutoRefresh((prev) => !prev)}
            className="inline-flex items-center gap-3 min-h-[44px] rounded-xl px-4 border border-border bg-bg-card text-text-main font-semibold hover:bg-bg-input transition-colors"
          >
            <span
              className={[
                "relative inline-flex items-center w-11 h-6 rounded-full border border-border transition-colors",
                autoRefresh ? "bg-bear-gradient" : "bg-bg-input",
              ].join(" ")}
              aria-hidden
            >
              <span
                className={[
                  "absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-bg-card shadow-sm transition-transform",
                  autoRefresh ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </span>
            <span className="text-sm">Actualizar en vivo</span>
          </button>

          <button
            type="button"
            onClick={() => void refresh()}
            className="ml-auto inline-flex items-center gap-2 bg-bear-gradient text-bear-dark-500 hover:opacity-95 font-medium rounded-pill px-4 py-2 transition-colors"
          >
            <RefreshCw size={18} aria-hidden />
            Refrescar
          </button>
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
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 bg-bear-gradient text-bear-dark-500 hover:opacity-95 font-medium rounded-pill px-4 py-2 transition-colors"
          >
            <RefreshCw size={18} aria-hidden />
            Reintentar
          </button>
        </div>
      ) : snapshot ? (
        <div className="crm-wrap">
          <section className="crm-meta" aria-label="Contexto del panel CRM">
            <p className="crm-range">{rangeLabel}</p>
            <p className="crm-updated">
              Última actualización: <strong>{updatedAtLabel}</strong>
            </p>
            <div className="crm-source-row">
              <span className="crm-source-row__label">
                <Database size={15} aria-hidden />
                Métricas basadas en tablas reales:
              </span>
              <div className="crm-source-row__chips">
                {dataSources.map((source) => (
                  <span key={source} className="crm-chip">
                    {source}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {actionToast ? (
            <div className="crm-toast" role="status">
              {actionToast}
            </div>
          ) : null}

          <div
            className="crm-kpi-grid"
            role="list"
            aria-label="KPIs principales"
          >
            <KpiCard
              title="Usuarios totales"
              value={formatCompactNumber(snapshot.kpis.totalUsers)}
              helper="Histórico"
              icon={Users}
            />
            <KpiCard
              title="Registros"
              value={formatCompactNumber(snapshot.kpis.registrations)}
              helper={formatRecentWindow(snapshot.range.days)}
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
              title="Trial started (evento)"
              value={formatCompactNumber(trialEventTotals.trialStarts)}
              helper="Evento canónico: trial_started (analytics_events)"
              icon={Clock}
            />
            <KpiCard
              title="Trial → Paid (evento)"
              value={formatCompactNumber(trialEventTotals.trialConversions)}
              helper={`Conversión ${formatPct(snapshot.kpis.trialConversionRatePct)}`}
              icon={TrendingUp}
            />
            <KpiCard
              title="Cancelaciones"
              value={formatCompactNumber(snapshot.kpis.cancellations)}
              helper={`Involuntarias: ${formatCompactNumber(snapshot.kpis.involuntaryCancellations)}`}
              icon={AlertTriangle}
            />
            <KpiCard
              title="Registro → primer pago"
              value={formatDecimal(
                snapshot.kpis.avgHoursRegisterToFirstPaid,
                2,
              )}
              helper="Promedio horas"
              icon={Clock}
            />
            <KpiCard
              title="Pago → primera descarga"
              value={formatDecimal(
                snapshot.kpis.medianHoursPaidToFirstDownload,
                2,
              )}
              helper={`Mediana horas · P90 ${formatDecimal(snapshot.kpis.p90HoursPaidToFirstDownload, 2)} · Promedio ${formatDecimal(snapshot.kpis.avgHoursPaidToFirstDownload, 2)}`}
              icon={TrendingUp}
            />
          </div>

          <section className="crm-signal-grid" aria-label="Señales operativas">
            {signals.map((signal) => (
              <SignalCard
                key={signal.title}
                title={signal.title}
                value={signal.value}
                helper={signal.helper}
                tone={signal.tone}
              />
            ))}
          </section>

          {automation ? (
            <section className="crm-section">
              <div className="crm-section__title-row">
                <h2 className="crm-section__title">Automatizaciones</h2>
                <span className="crm-counter">
                  {automation.recentRuns.length}
                </span>
              </div>
              <p className="crm-section__hint">
                Acciones últimas 24h:{" "}
                <strong>{automation.actionsLast24h}</strong>
              </p>
              <div
                className="crm-table-wrap"
                tabIndex={0}
                aria-label="Tabla: historial de automations (desplazable)"
              >
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Run ID</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {automation.recentRuns.map((run) => (
                      <tr key={run.id}>
                        <td>{run.id}</td>
                        <td>{formatDateLabel(run.startedAt, true)}</td>
                        <td>
                          {run.finishedAt
                            ? formatDateLabel(run.finishedAt, true)
                            : "—"}
                        </td>
                        <td>
                          <span
                            className={`crm-status-pill crm-status-pill--${getStatusTone(run.status)}`}
                          >
                            {formatStatus(run.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {automation.recentRuns.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="crm-table__empty">
                          Aún no hay corridas registradas.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div
                className="admin-mobile-list"
                aria-label="Automatizaciones (móvil)"
              >
                {automation.recentRuns.length === 0 ? (
                  <div className="admin-mobile-empty">
                    <h2>Sin corridas</h2>
                    <p>Aún no hay corridas registradas.</p>
                  </div>
                ) : (
                  automation.recentRuns.map((run) => (
                    <article
                      key={`m_run_${run.id}`}
                      className="admin-mobile-card"
                    >
                      <header className="crm-mobile-card__head">
                        <div className="crm-mobile-card__copy">
                          <p className="crm-mobile-card__title">
                            Run #{run.id}
                          </p>
                          <p className="crm-mobile-card__subtitle">
                            {formatDateLabel(run.startedAt, true)} →{" "}
                            {run.finishedAt
                              ? formatDateLabel(run.finishedAt, true)
                              : "—"}
                          </p>
                        </div>
                        <span
                          className={`crm-status-pill crm-status-pill--${getStatusTone(run.status)}`}
                        >
                          {formatStatus(run.status)}
                        </span>
                      </header>
                      {run.error ? (
                        <p className="crm-mobile-card__note">{run.error}</p>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </section>
          ) : null}

          <div className="crm-section-grid">
            <section className="crm-section">
              <div className="crm-section__title-row">
                <h2 className="crm-section__title">Registros diarios</h2>
                <span className="crm-counter">
                  {snapshot.registrationsDaily.length}
                </span>
              </div>
              <p className="crm-section__hint">
                Últimos 14 días con acumulado para ver tendencia real.
              </p>
              <div
                className="crm-table-wrap"
                tabIndex={0}
                aria-label="Tabla: registros diarios (desplazable)"
              >
                <table className="crm-table crm-table--compact">
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
                        <td>{formatDay(row.day)}</td>
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
              <div
                className="admin-mobile-list"
                aria-label="Registros diarios (móvil)"
              >
                {snapshot.registrationsDaily.length === 0 ? (
                  <div className="admin-mobile-empty">
                    <h2>Sin datos</h2>
                    <p>Sin datos en este rango.</p>
                  </div>
                ) : (
                  snapshot.registrationsDaily.slice(-14).map((row) => (
                    <article
                      key={`m_reg_${row.day}`}
                      className="admin-mobile-card"
                    >
                      <header className="crm-mobile-card__head">
                        <div className="crm-mobile-card__copy">
                          <p className="crm-mobile-card__title">
                            {formatDay(row.day)}
                          </p>
                        </div>
                      </header>
                      <dl className="crm-mobile-kv">
                        <div className="crm-mobile-kv__row">
                          <dt>Registros</dt>
                          <dd>{row.registrations}</dd>
                        </div>
                        <div className="crm-mobile-kv__row">
                          <dt>Acumulado</dt>
                          <dd>{row.cumulative}</dd>
                        </div>
                      </dl>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="crm-section">
              <div className="crm-section__title-row">
                <h2 className="crm-section__title">
                  Trial started (evento) por día
                </h2>
                <span className="crm-counter">
                  {snapshot.trialsDaily.length}
                </span>
              </div>
              <p className="crm-section__hint">
                Definición única de Trial: evento <code>trial_started</code> en{" "}
                <code>analytics_events</code>.
              </p>
              <div
                className="crm-table-wrap"
                tabIndex={0}
                aria-label="Tabla: trial started por día (desplazable)"
              >
                <table className="crm-table crm-table--compact">
                  <thead>
                    <tr>
                      <th>Día</th>
                      <th>Trial started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.trialsDaily.map((row) => (
                      <tr key={row.day}>
                        <td>{formatDay(row.day)}</td>
                        <td>{row.trialStarts}</td>
                      </tr>
                    ))}
                    {snapshot.trialsDaily.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="crm-table__empty">
                          Aún no hay eventos trial_started.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div
                className="admin-mobile-list"
                aria-label="Trial started por día (móvil)"
              >
                {snapshot.trialsDaily.length === 0 ? (
                  <div className="admin-mobile-empty">
                    <h2>Sin datos</h2>
                    <p>Aún no hay eventos trial_started.</p>
                  </div>
                ) : (
                  snapshot.trialsDaily.map((row) => (
                    <article
                      key={`m_trial_${row.day}`}
                      className="admin-mobile-card"
                    >
                      <header className="crm-mobile-card__head">
                        <div className="crm-mobile-card__copy">
                          <p className="crm-mobile-card__title">
                            {formatDay(row.day)}
                          </p>
                        </div>
                      </header>
                      <dl className="crm-mobile-kv">
                        <div className="crm-mobile-kv__row">
                          <dt>Trial started</dt>
                          <dd>{row.trialStarts}</dd>
                        </div>
                      </dl>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          <section className="crm-section">
            <div className="crm-section__title-row">
              <h2 className="crm-section__title">Cancelaciones por razón</h2>
              <span className="crm-counter">
                {snapshot.cancellationTopReasons.length}
              </span>
            </div>
            <p className="crm-section__hint">
              Total en el rango: <strong>{snapshot.kpis.cancellations}</strong>
            </p>
            <div
              className="crm-table-wrap"
              tabIndex={0}
              aria-label="Tabla: cancelaciones por razón (desplazable)"
            >
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
                      <td>{formatReasonCode(row.reasonCode)}</td>
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
            <div
              className="admin-mobile-list"
              aria-label="Cancelaciones por razón (móvil)"
            >
              {snapshot.cancellationTopReasons.length === 0 ? (
                <div className="admin-mobile-empty">
                  <h2>Sin datos</h2>
                  <p>Sin datos en este rango.</p>
                </div>
              ) : (
                snapshot.cancellationTopReasons.map((row) => (
                  <article
                    key={`m_reason_${row.reasonCode}`}
                    className="admin-mobile-card"
                  >
                    <header className="crm-mobile-card__head">
                      <div className="crm-mobile-card__copy">
                        <p className="crm-mobile-card__title">
                          {formatReasonCode(row.reasonCode)}
                        </p>
                      </div>
                      <span className="crm-status-pill crm-status-pill--neutral">
                        {row.cancellations.toLocaleString("es-MX")}
                      </span>
                    </header>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="crm-section">
            <div className="crm-section__title-row">
              <h2 className="crm-section__title">Activación de valor</h2>
              <span className="crm-counter">24h</span>
            </div>
            <p className="crm-section__hint">
              Pago → primera descarga (desde <code>download_history</code>,
              primer download después del primer pago): mediana{" "}
              <strong>
                {formatDecimal(snapshot.kpis.medianHoursPaidToFirstDownload, 2)}
              </strong>{" "}
              h, p90{" "}
              <strong>
                {formatDecimal(snapshot.kpis.p90HoursPaidToFirstDownload, 2)}
              </strong>{" "}
              h, promedio{" "}
              <strong>
                {formatDecimal(snapshot.kpis.avgHoursPaidToFirstDownload, 2)}
              </strong>{" "}
              h.
            </p>
          </section>

          <section className="crm-section">
            <div className="crm-section__title-row">
              <h2 className="crm-section__title">
                Trial started sin descarga en 24h
              </h2>
              <span className="crm-counter">
                {snapshot.trialNoDownload24hTotal.toLocaleString("es-MX")}
              </span>
            </div>
            <p className="crm-section__hint">
              Segmento crítico basado en <code>trial_started</code>: necesitan
              onboarding para activar valor antes del día 7.
            </p>
            <div
              className="crm-table-wrap"
              tabIndex={0}
              aria-label="Tabla: trial started sin descarga (24h) (desplazable)"
            >
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Trial inició</th>
                    <th>Plan</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.trialNoDownload24h.map((row) => (
                    <tr key={`${row.userId}-${row.trialStartedAt}`}>
                      <td>{row.userId}</td>
                      <td>{row.username}</td>
                      <td>{row.email}</td>
                      <td>{row.phone ?? "—"}</td>
                      <td>{formatDateLabel(row.trialStartedAt, true)}</td>
                      <td>{row.planId ?? "—"}</td>
                      <td className="crm-actions">
                        <button
                          type="button"
                          className="crm-action-btn"
                          disabled={
                            actionBusyKey === `trial-onboard-${row.userId}`
                          }
                          onClick={() =>
                            void runAction(
                              `trial-onboard-${row.userId}`,
                              async () => {
                                await trpc.analytics.adminAddManyChatTag.mutate(
                                  {
                                    userId: row.userId,
                                    tagName: "AUTOMATION_TRIAL_NO_DOWNLOAD_24H",
                                  },
                                );
                              },
                            )
                          }
                        >
                          Onboarding
                        </button>
                        <button
                          type="button"
                          className="crm-action-btn crm-action-btn--ghost"
                          disabled={
                            actionBusyKey === `trial-contact-${row.userId}`
                          }
                          onClick={() =>
                            void runAction(
                              `trial-contact-${row.userId}`,
                              async () => {
                                await trpc.analytics.adminMarkContacted.mutate({
                                  userId: row.userId,
                                  note: "trial_no_download_24h",
                                });
                              },
                            )
                          }
                        >
                          Contactado
                        </button>
                      </td>
                    </tr>
                  ))}
                  {snapshot.trialNoDownload24h.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="crm-table__empty">
                        Todo bien: no hay usuarios en este segmento.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div
              className="admin-mobile-list"
              aria-label="Trial started sin descarga (móvil)"
            >
              {snapshot.trialNoDownload24h.length === 0 ? (
                <div className="admin-mobile-empty">
                  <h2>Todo bien</h2>
                  <p>No hay usuarios en este segmento.</p>
                </div>
              ) : (
                snapshot.trialNoDownload24h.map((row) => (
                  <article
                    key={`m_trial_no_dl_${row.userId}_${row.trialStartedAt}`}
                    className="admin-mobile-card"
                  >
                    <header className="crm-mobile-card__head">
                      <div className="crm-mobile-card__copy">
                        <p className="crm-mobile-card__title">
                          #{row.userId} {row.username}
                        </p>
                        <p className="crm-mobile-card__subtitle">{row.email}</p>
                      </div>
                      <span className="crm-status-pill crm-status-pill--warn">
                        24h
                      </span>
                    </header>
                    <dl className="crm-mobile-kv">
                      <div className="crm-mobile-kv__row">
                        <dt>Teléfono</dt>
                        <dd>{row.phone ?? "—"}</dd>
                      </div>
                      <div className="crm-mobile-kv__row">
                        <dt>Trial inició</dt>
                        <dd>{formatDateLabel(row.trialStartedAt, true)}</dd>
                      </div>
                      <div className="crm-mobile-kv__row">
                        <dt>Plan</dt>
                        <dd>{row.planId ?? "—"}</dd>
                      </div>
                    </dl>
                    <div className="crm-actions crm-mobile-card__actions">
                      <button
                        type="button"
                        className="crm-action-btn"
                        disabled={
                          actionBusyKey === `trial-onboard-${row.userId}`
                        }
                        onClick={() =>
                          void runAction(
                            `trial-onboard-${row.userId}`,
                            async () => {
                              await trpc.analytics.adminAddManyChatTag.mutate({
                                userId: row.userId,
                                tagName: "AUTOMATION_TRIAL_NO_DOWNLOAD_24H",
                              });
                            },
                          )
                        }
                      >
                        Onboarding
                      </button>
                      <button
                        type="button"
                        className="crm-action-btn crm-action-btn--ghost"
                        disabled={
                          actionBusyKey === `trial-contact-${row.userId}`
                        }
                        onClick={() =>
                          void runAction(
                            `trial-contact-${row.userId}`,
                            async () => {
                              await trpc.analytics.adminMarkContacted.mutate({
                                userId: row.userId,
                                note: "trial_no_download_24h",
                              });
                            },
                          )
                        }
                      >
                        Contactado
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
            <Pagination
              title="trial started sin descarga (24h)"
              totalData={snapshot.trialNoDownload24hTotal}
              totalLoader={loading}
              startFilter={(_key, value) =>
                setTrialNoDownloadPage(
                  typeof value === "number" ? value : Number(value),
                )
              }
              currentPage={trialNoDownloadPage}
              limit={listLimit}
            />
          </section>

          <section className="crm-section">
            <div className="crm-section__title-row">
              <h2 className="crm-section__title">
                Pagaron y no descargaron en 2h
              </h2>
              <span className="crm-counter">
                {snapshot.paidNoDownload2hTotal.toLocaleString("es-MX")}
              </span>
            </div>
            <p className="crm-section__hint">
              Segmento de activación temprana para intervenir durante la ventana
              de mayor intención.
            </p>
            <div
              className="crm-table-wrap"
              tabIndex={0}
              aria-label="Tabla: pagaron y no descargaron (2h) (desplazable)"
            >
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Pagó</th>
                    <th>Plan</th>
                    <th>Método</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.paidNoDownload2h.map((row) => (
                    <tr key={`${row.userId}-${row.paidAt}-2h`}>
                      <td>{row.userId}</td>
                      <td>{row.username}</td>
                      <td>{row.email}</td>
                      <td>{row.phone ?? "—"}</td>
                      <td>{formatDateLabel(row.paidAt, true)}</td>
                      <td>{row.planId ?? "—"}</td>
                      <td>{formatPaymentMethod(row.paymentMethod)}</td>
                      <td className="crm-actions">
                        <button
                          type="button"
                          className="crm-action-btn"
                          disabled={
                            actionBusyKey === `paid2h-onboard-${row.userId}`
                          }
                          onClick={() =>
                            void runAction(
                              `paid2h-onboard-${row.userId}`,
                              async () => {
                                await trpc.analytics.adminAddManyChatTag.mutate(
                                  {
                                    userId: row.userId,
                                    tagName: "AUTOMATION_PAID_NO_DOWNLOAD_2H",
                                  },
                                );
                              },
                            )
                          }
                        >
                          Onboarding
                        </button>
                        <button
                          type="button"
                          className="crm-action-btn crm-action-btn--ghost"
                          disabled={
                            actionBusyKey === `paid2h-contact-${row.userId}`
                          }
                          onClick={() =>
                            void runAction(
                              `paid2h-contact-${row.userId}`,
                              async () => {
                                await trpc.analytics.adminMarkContacted.mutate({
                                  userId: row.userId,
                                  note: "paid_no_download_2h",
                                });
                              },
                            )
                          }
                        >
                          Contactado
                        </button>
                      </td>
                    </tr>
                  ))}
                  {snapshot.paidNoDownload2h.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="crm-table__empty">
                        Todo bien: no hay usuarios en este segmento.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div
              className="admin-mobile-list"
              aria-label="Pagaron y no descargaron en 2h (móvil)"
            >
              {snapshot.paidNoDownload2h.length === 0 ? (
                <div className="admin-mobile-empty">
                  <h2>Todo bien</h2>
                  <p>No hay usuarios en este segmento.</p>
                </div>
              ) : (
                snapshot.paidNoDownload2h.map((row) => (
                  <article
                    key={`m_paid_no_dl_2h_${row.userId}_${row.paidAt}`}
                    className="admin-mobile-card"
                  >
                    <header className="crm-mobile-card__head">
                      <div className="crm-mobile-card__copy">
                        <p className="crm-mobile-card__title">
                          #{row.userId} {row.username}
                        </p>
                        <p className="crm-mobile-card__subtitle">{row.email}</p>
                      </div>
                      <span className="crm-status-pill crm-status-pill--warn">
                        2h
                      </span>
                    </header>
                    <dl className="crm-mobile-kv">
                      <div className="crm-mobile-kv__row">
                        <dt>Teléfono</dt>
                        <dd>{row.phone ?? "—"}</dd>
                      </div>
                      <div className="crm-mobile-kv__row">
                        <dt>Pagó</dt>
                        <dd>{formatDateLabel(row.paidAt, true)}</dd>
                      </div>
                      <div className="crm-mobile-kv__row">
                        <dt>Plan</dt>
                        <dd>{row.planId ?? "—"}</dd>
                      </div>
                      <div className="crm-mobile-kv__row">
                        <dt>Método</dt>
                        <dd>{formatPaymentMethod(row.paymentMethod)}</dd>
                      </div>
                    </dl>
                    <div className="crm-actions crm-mobile-card__actions">
                      <button
                        type="button"
                        className="crm-action-btn"
                        disabled={
                          actionBusyKey === `paid2h-onboard-${row.userId}`
                        }
                        onClick={() =>
                          void runAction(
                            `paid2h-onboard-${row.userId}`,
                            async () => {
                              await trpc.analytics.adminAddManyChatTag.mutate({
                                userId: row.userId,
                                tagName: "AUTOMATION_PAID_NO_DOWNLOAD_2H",
                              });
                            },
                          )
                        }
                      >
                        Onboarding
                      </button>
                      <button
                        type="button"
                        className="crm-action-btn crm-action-btn--ghost"
                        disabled={
                          actionBusyKey === `paid2h-contact-${row.userId}`
                        }
                        onClick={() =>
                          void runAction(
                            `paid2h-contact-${row.userId}`,
                            async () => {
                              await trpc.analytics.adminMarkContacted.mutate({
                                userId: row.userId,
                                note: "paid_no_download_2h",
                              });
                            },
                          )
                        }
                      >
                        Contactado
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
            <Pagination
              title="pagaron sin descarga (2h)"
              totalData={snapshot.paidNoDownload2hTotal}
              totalLoader={loading}
              startFilter={(_key, value) =>
                setPaidNoDownload2hPage(
                  typeof value === "number" ? value : Number(value),
                )
              }
              currentPage={paidNoDownload2hPage}
              limit={listLimit}
            />
          </section>

          <section className="crm-section">
            <div className="crm-section__title-row">
              <h2 className="crm-section__title">
                Pagaron y no descargaron en 24h
              </h2>
              <span className="crm-counter">
                {snapshot.paidNoDownload24hTotal.toLocaleString("es-MX")}
              </span>
            </div>
            <p className="crm-section__hint">
              Lista enfocada en primeras compras dentro del rango.
            </p>
            <div
              className="crm-table-wrap"
              tabIndex={0}
              aria-label="Tabla: pagaron y no descargaron (24h) (desplazable)"
            >
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Pagó</th>
                    <th>Plan</th>
                    <th>Método</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.paidNoDownload24h.map((row) => (
                    <tr key={`${row.userId}-${row.paidAt}`}>
                      <td>{row.userId}</td>
                      <td>{row.username}</td>
                      <td>{row.email}</td>
                      <td>{row.phone ?? "—"}</td>
                      <td>{formatDateLabel(row.paidAt, true)}</td>
                      <td>{row.planId ?? "—"}</td>
                      <td>{formatPaymentMethod(row.paymentMethod)}</td>
                      <td className="crm-actions">
                        <button
                          type="button"
                          className="crm-action-btn"
                          disabled={
                            actionBusyKey === `paid-onboard-${row.userId}`
                          }
                          onClick={() =>
                            void runAction(
                              `paid-onboard-${row.userId}`,
                              async () => {
                                await trpc.analytics.adminAddManyChatTag.mutate(
                                  {
                                    userId: row.userId,
                                    tagName: "AUTOMATION_PAID_NO_DOWNLOAD_24H",
                                  },
                                );
                              },
                            )
                          }
                        >
                          Onboarding
                        </button>
                        <button
                          type="button"
                          className="crm-action-btn crm-action-btn--ghost"
                          disabled={
                            actionBusyKey === `paid-contact-${row.userId}`
                          }
                          onClick={() =>
                            void runAction(
                              `paid-contact-${row.userId}`,
                              async () => {
                                await trpc.analytics.adminMarkContacted.mutate({
                                  userId: row.userId,
                                  note: "paid_no_download_24h",
                                });
                              },
                            )
                          }
                        >
                          Contactado
                        </button>
                      </td>
                    </tr>
                  ))}
                  {snapshot.paidNoDownload24h.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="crm-table__empty">
                        Todo bien: no hay usuarios en este segmento.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div
              className="admin-mobile-list"
              aria-label="Pagaron y no descargaron (móvil)"
            >
              {snapshot.paidNoDownload24h.length === 0 ? (
                <div className="admin-mobile-empty">
                  <h2>Todo bien</h2>
                  <p>No hay usuarios en este segmento.</p>
                </div>
              ) : (
                snapshot.paidNoDownload24h.map((row) => (
                  <article
                    key={`m_paid_no_dl_${row.userId}_${row.paidAt}`}
                    className="admin-mobile-card"
                  >
                    <header className="crm-mobile-card__head">
                      <div className="crm-mobile-card__copy">
                        <p className="crm-mobile-card__title">
                          #{row.userId} {row.username}
                        </p>
                        <p className="crm-mobile-card__subtitle">{row.email}</p>
                      </div>
                      <span className="crm-status-pill crm-status-pill--warn">
                        24h
                      </span>
                    </header>
                    <dl className="crm-mobile-kv">
                      <div className="crm-mobile-kv__row">
                        <dt>Teléfono</dt>
                        <dd>{row.phone ?? "—"}</dd>
                      </div>
                      <div className="crm-mobile-kv__row">
                        <dt>Pagó</dt>
                        <dd>{formatDateLabel(row.paidAt, true)}</dd>
                      </div>
                      <div className="crm-mobile-kv__row">
                        <dt>Plan</dt>
                        <dd>{row.planId ?? "—"}</dd>
                      </div>
                      <div className="crm-mobile-kv__row">
                        <dt>Método</dt>
                        <dd>{formatPaymentMethod(row.paymentMethod)}</dd>
                      </div>
                    </dl>
                    <div className="crm-actions crm-mobile-card__actions">
                      <button
                        type="button"
                        className="crm-action-btn"
                        disabled={
                          actionBusyKey === `paid-onboard-${row.userId}`
                        }
                        onClick={() =>
                          void runAction(
                            `paid-onboard-${row.userId}`,
                            async () => {
                              await trpc.analytics.adminAddManyChatTag.mutate({
                                userId: row.userId,
                                tagName: "AUTOMATION_PAID_NO_DOWNLOAD_24H",
                              });
                            },
                          )
                        }
                      >
                        Onboarding
                      </button>
                      <button
                        type="button"
                        className="crm-action-btn crm-action-btn--ghost"
                        disabled={
                          actionBusyKey === `paid-contact-${row.userId}`
                        }
                        onClick={() =>
                          void runAction(
                            `paid-contact-${row.userId}`,
                            async () => {
                              await trpc.analytics.adminMarkContacted.mutate({
                                userId: row.userId,
                                note: "paid_no_download_24h",
                              });
                            },
                          )
                        }
                      >
                        Contactado
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
            <Pagination
              title="pagaron sin descarga (24h)"
              totalData={snapshot.paidNoDownload24hTotal}
              totalLoader={loading}
              startFilter={(_key, value) =>
                setPaidNoDownloadPage(
                  typeof value === "number" ? value : Number(value),
                )
              }
              currentPage={paidNoDownloadPage}
              limit={listLimit}
            />
          </section>

          <section className="crm-section">
            <div className="crm-section__title-row">
              <h2 className="crm-section__title">Cancelaciones recientes</h2>
              <span className="crm-counter">
                {snapshot.recentCancellationsTotal.toLocaleString("es-MX")}
              </span>
            </div>
            <p className="crm-section__hint">
              Con motivo y atribución (si existe).
            </p>
            <div
              className="crm-table-wrap"
              tabIndex={0}
              aria-label="Tabla: cancelaciones recientes (desplazable)"
            >
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>User ID</th>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Método</th>
                    <th>Motivo</th>
                    <th>Campaña</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.recentCancellations.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateLabel(row.createdAt, true)}</td>
                      <td>{row.userId}</td>
                      <td>{row.username}</td>
                      <td>{row.email}</td>
                      <td>{row.phone ?? "—"}</td>
                      <td>{formatPaymentMethod(row.paymentMethod)}</td>
                      <td>{formatReasonCode(row.reasonCode)}</td>
                      <td>{row.campaign ?? "—"}</td>
                      <td className="crm-actions">
                        <button
                          type="button"
                          className="crm-action-btn"
                          disabled={
                            actionBusyKey === `cancel-offer-${row.userId}`
                          }
                          onClick={() =>
                            void runAction(
                              `cancel-offer-${row.userId}`,
                              async () => {
                                await trpc.analytics.adminCreateOffer.mutate({
                                  userId: row.userId,
                                  percentOff: 10,
                                });
                              },
                            )
                          }
                        >
                          Cupón 10%
                        </button>
                        <button
                          type="button"
                          className="crm-action-btn crm-action-btn--ghost"
                          disabled={
                            actionBusyKey === `cancel-contact-${row.userId}`
                          }
                          onClick={() =>
                            void runAction(
                              `cancel-contact-${row.userId}`,
                              async () => {
                                await trpc.analytics.adminMarkContacted.mutate({
                                  userId: row.userId,
                                  note: "recent_cancellation",
                                });
                              },
                            )
                          }
                        >
                          Contactado
                        </button>
                      </td>
                    </tr>
                  ))}
                  {snapshot.recentCancellations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="crm-table__empty">
                        Aún no hay cancelaciones en este rango.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div
              className="admin-mobile-list"
              aria-label="Cancelaciones recientes (móvil)"
            >
              {snapshot.recentCancellations.length === 0 ? (
                <div className="admin-mobile-empty">
                  <h2>Sin cancelaciones</h2>
                  <p>Aún no hay cancelaciones en este rango.</p>
                </div>
              ) : (
                snapshot.recentCancellations.map((row) => (
                  <article
                    key={`m_cancel_${row.id}`}
                    className="admin-mobile-card"
                  >
                    <header className="crm-mobile-card__head">
                      <div className="crm-mobile-card__copy">
                        <p className="crm-mobile-card__title">
                          #{row.userId} {row.username}
                        </p>
                        <p className="crm-mobile-card__subtitle">{row.email}</p>
                      </div>
                      <span className="crm-status-pill crm-status-pill--neutral">
                        {formatPaymentMethod(row.paymentMethod)}
                      </span>
                    </header>
                    <dl className="crm-mobile-kv">
                      <div className="crm-mobile-kv__row">
                        <dt>Fecha</dt>
                        <dd>{formatDateLabel(row.createdAt, true)}</dd>
                      </div>
                      <div className="crm-mobile-kv__row">
                        <dt>Motivo</dt>
                        <dd className="is-wrap">
                          {formatReasonCode(row.reasonCode)}
                        </dd>
                      </div>
                      <div className="crm-mobile-kv__row">
                        <dt>Campaña</dt>
                        <dd className="is-wrap">{row.campaign ?? "—"}</dd>
                      </div>
                    </dl>
                    <div className="crm-actions crm-mobile-card__actions">
                      <button
                        type="button"
                        className="crm-action-btn"
                        disabled={
                          actionBusyKey === `cancel-offer-${row.userId}`
                        }
                        onClick={() =>
                          void runAction(
                            `cancel-offer-${row.userId}`,
                            async () => {
                              await trpc.analytics.adminCreateOffer.mutate({
                                userId: row.userId,
                                percentOff: 10,
                              });
                            },
                          )
                        }
                      >
                        Cupón 10%
                      </button>
                      <button
                        type="button"
                        className="crm-action-btn crm-action-btn--ghost"
                        disabled={
                          actionBusyKey === `cancel-contact-${row.userId}`
                        }
                        onClick={() =>
                          void runAction(
                            `cancel-contact-${row.userId}`,
                            async () => {
                              await trpc.analytics.adminMarkContacted.mutate({
                                userId: row.userId,
                                note: "recent_cancellation",
                              });
                            },
                          )
                        }
                      >
                        Contactado
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
            <Pagination
              title="cancelaciones"
              totalData={snapshot.recentCancellationsTotal}
              totalLoader={loading}
              startFilter={(_key, value) =>
                setRecentCancellationsPage(
                  typeof value === "number" ? value : Number(value),
                )
              }
              currentPage={recentCancellationsPage}
              limit={listLimit}
            />
          </section>
        </div>
      ) : null}
    </AdminPageLayout>
  );
}
