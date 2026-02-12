import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  CreditCard,
  DollarSign,
  Gauge,
  RefreshCw,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import trpc from "../../../api";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { Spinner } from "../../../components/Spinner/Spinner";
import "./AnalyticsDashboard.scss";

interface FunnelOverview {
  range: {
    days: number;
    start: string;
    end: string;
  };
  volume: {
    visitors: number;
    registrations: number;
    checkoutStarted: number;
    paidOrders: number;
    grossRevenue: number;
    activationD1Users: number;
    registrationCohort: number;
    retainedD30Users: number;
    retentionD30Base: number;
  };
  conversion: {
    visitorToRegisterPct: number;
    registerToCheckoutPct: number;
    checkoutToPaidPct: number;
    visitorToPaidPct: number;
    activationD1Pct: number;
    retentionD30Pct: number;
  };
}

interface DailyPoint {
  day: string;
  visitors: number;
  registrations: number;
  checkoutStarted: number;
  purchases: number;
}

interface AttributionPoint {
  source: string;
  medium: string;
  campaign: string;
  visitors: number;
  registrations: number;
  checkouts: number;
  purchases: number;
  revenue: number;
  aov: number;
}

interface CancellationReasonCampaignPoint {
  source: string;
  medium: string;
  campaign: string;
  cancellations: number;
}

interface CancellationReasonPoint {
  reasonCode: string;
  cancellations: number;
  topCampaigns: CancellationReasonCampaignPoint[];
}

interface CancellationReasonsSnapshot {
  range: {
    days: number;
    start: string;
    end: string;
  };
  voluntaryCancellations: number;
  involuntaryCancellations: number;
  totalCancellations: number;
  reasons: CancellationReasonPoint[];
}

interface BusinessMetrics {
  range: {
    days: number;
    start: string;
    end: string;
    churnWindowDays: number;
  };
  kpis: {
    paidOrders: number;
    paidUsers: number;
    grossRevenue: number;
    avgOrderValue: number;
    arpu: number;
    monthlyRecurringRevenueEstimate: number;
    monthlyArpuEstimate: number;
    repeatPurchaseRatePct: number;
    refundRatePct: number;
    churnMonthlyPct: number;
    ltvEstimate: number | null;
    cacEstimate: number | null;
    paybackMonthsEstimate: number | null;
  };
  cohorts: {
    previousActiveUsers: number;
    currentActiveUsers: number;
    lostUsers: number;
    newUsers: number;
  };
  assumptions: {
    cacSource: "manual-input" | "env-default" | "not-available";
    adSpendUsed: number | null;
  };
}

interface UxPoint {
  samples: number;
  poorCount: number;
  poorRatePct: number;
  lcpAvg: number | null;
  clsAvg: number | null;
  inpAvg: number | null;
}

interface UxRoutePoint extends UxPoint {
  pagePath: string;
}

interface UxDevicePoint extends UxPoint {
  deviceCategory: string;
}

interface UxSummary {
  range: {
    days: number;
    start: string;
    end: string;
  };
  totals: UxPoint;
  routes: UxRoutePoint[];
  devices: UxDevicePoint[];
}

interface TopEventPoint {
  eventName: string;
  eventCategory: string;
  totalEvents: number;
  uniqueVisitors: number;
  uniqueSessions: number;
}

interface HealthAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  recommendation: string;
}

interface HealthAlertsSnapshot {
  generatedAt: string;
  alerts: HealthAlert[];
}

const RANGE_OPTIONS = [7, 14, 30, 60, 90, 120];

const CANCELLATION_REASON_LABELS: Record<string, string> = {
  too_expensive: "Es muy caro",
  not_using_enough: "No lo estoy usando suficiente",
  missing_content: "No encontré lo que buscaba",
  technical_issues: "Problemas técnicos / algo roto",
  found_alternative: "Encontré otra alternativa",
  temporary_pause: "Pausa temporal",
  other: "Otro",
  admin_blocked: "Cancelación por admin (bloqueo)",
};

function formatCancellationReason(code: string): string {
  const normalized = (code || "").trim();
  return CANCELLATION_REASON_LABELS[normalized] ?? normalized ?? "—";
}

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

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-MX");
}

export function AnalyticsDashboard() {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [manualAdSpend, setManualAdSpend] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>("");

  const [funnel, setFunnel] = useState<FunnelOverview | null>(null);
  const [series, setSeries] = useState<DailyPoint[]>([]);
  const [attribution, setAttribution] = useState<AttributionPoint[]>([]);
  const [cancellations, setCancellations] = useState<CancellationReasonsSnapshot | null>(null);
  const [business, setBusiness] = useState<BusinessMetrics | null>(null);
  const [ux, setUx] = useState<UxSummary | null>(null);
  const [topEvents, setTopEvents] = useState<TopEventPoint[]>([]);
  const [alerts, setAlerts] = useState<HealthAlertsSnapshot | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const normalizedAdSpend = Number(manualAdSpend);
      const adSpend =
        manualAdSpend.trim() !== "" && Number.isFinite(normalizedAdSpend) && normalizedAdSpend >= 0
          ? normalizedAdSpend
          : undefined;

      const [
        funnelResponse,
        seriesResponse,
        attributionResponse,
        cancellationsResponse,
        businessResponse,
        uxResponse,
        topEventsResponse,
        alertsResponse,
      ] = await Promise.all([
        trpc.analytics.getAnalyticsFunnelOverview.query({ days: rangeDays }),
        trpc.analytics.getAnalyticsDailySeries.query({ days: rangeDays }),
        trpc.analytics.getAnalyticsAttribution.query({ days: rangeDays, limit: 12 }),
        trpc.analytics.getAnalyticsCancellationReasons.query({ days: rangeDays, topCampaigns: 5 }),
        trpc.analytics.getAnalyticsBusinessMetrics.query({ days: rangeDays, adSpend }),
        trpc.analytics.getAnalyticsUxQuality.query({ days: rangeDays, routesLimit: 12 }),
        trpc.analytics.getAnalyticsTopEvents.query({ days: rangeDays, limit: 20 }),
        trpc.analytics.getAnalyticsAlerts.query({ days: rangeDays }),
      ]);

      setFunnel(funnelResponse as FunnelOverview);
      setSeries(seriesResponse as DailyPoint[]);
      setAttribution(attributionResponse as AttributionPoint[]);
      setCancellations(cancellationsResponse as CancellationReasonsSnapshot);
      setBusiness(businessResponse as BusinessMetrics);
      setUx(uxResponse as UxSummary);
      setTopEvents(topEventsResponse as TopEventPoint[]);
      setAlerts(alertsResponse as HealthAlertsSnapshot);
      setLastUpdatedAt(new Date().toISOString());
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "No fue posible cargar las métricas.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [rangeDays, manualAdSpend]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const toolbar = (
    <div className="analytics-toolbar">
      <div className="analytics-toolbar__group">
        <label className="analytics-toolbar__range">
          Ventana de análisis
          <select
            value={rangeDays}
            onChange={(event) => setRangeDays(Number(event.target.value))}
          >
            {RANGE_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days} días
              </option>
            ))}
          </select>
        </label>
        <label className="analytics-toolbar__range">
          Inversión mensual (MXN)
          <input
            type="number"
            min={0}
            step={0.01}
            value={manualAdSpend}
            onChange={(event) => setManualAdSpend(event.target.value)}
            placeholder="Opcional"
          />
        </label>
      </div>
      <div className="analytics-toolbar__actions">
        <span className="analytics-toolbar__updated">
          <CalendarClock size={14} />
          Actualizado: {formatDateTime(lastUpdatedAt)}
        </span>
        <button
          type="button"
          onClick={() => void fetchAnalytics()}
          disabled={loading}
          className="analytics-toolbar__refresh"
        >
          <RefreshCw size={16} className={loading ? "is-spinning" : ""} />
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>
    </div>
  );

  const kpiCards = useMemo(() => {
    if (!funnel || !business) return [];
    return [
      {
        id: "visitors",
        label: "Visitantes únicos",
        value: formatCompactNumber(funnel.volume.visitors),
        helper: `V→R ${formatPct(funnel.conversion.visitorToRegisterPct)}`,
        icon: Users,
      },
      {
        id: "registrations",
        label: "Registros",
        value: formatCompactNumber(funnel.volume.registrations),
        helper: `R→Checkout ${formatPct(funnel.conversion.registerToCheckoutPct)}`,
        icon: UserPlus,
      },
      {
        id: "checkout",
        label: "Checkout iniciado",
        value: formatCompactNumber(funnel.volume.checkoutStarted),
        helper: `Checkout→Pago ${formatPct(funnel.conversion.checkoutToPaidPct)}`,
        icon: CreditCard,
      },
      {
        id: "paid",
        label: "Órdenes pagadas",
        value: formatCompactNumber(funnel.volume.paidOrders),
        helper: `V→Pago ${formatPct(funnel.conversion.visitorToPaidPct)}`,
        icon: Activity,
      },
      {
        id: "revenue",
        label: "Ingreso bruto",
        value: formatCurrency(funnel.volume.grossRevenue),
        helper: `${funnel.range.days} días`,
        icon: DollarSign,
      },
      {
        id: "activation",
        label: "Activación D1",
        value: formatPct(funnel.conversion.activationD1Pct),
        helper: `${funnel.volume.activationD1Users}/${funnel.volume.registrationCohort}`,
        icon: TrendingUp,
      },
      {
        id: "churn",
        label: "Churn mensual",
        value: formatPct(business.kpis.churnMonthlyPct),
        helper: `${business.cohorts.lostUsers}/${business.cohorts.previousActiveUsers} usuarios perdidos`,
        icon: AlertTriangle,
      },
      {
        id: "ltv",
        label: "LTV estimado",
        value: formatCurrency(business.kpis.ltvEstimate),
        helper: `ARPU mes: ${formatCurrency(business.kpis.monthlyArpuEstimate)}`,
        icon: Gauge,
      },
      {
        id: "cac",
        label: "CAC estimado",
        value: formatCurrency(business.kpis.cacEstimate),
        helper:
          business.assumptions.cacSource === "manual-input"
            ? "Fuente: manual"
            : business.assumptions.cacSource === "env-default"
              ? "Fuente: configuración"
              : "Configura ad spend para calcular",
        icon: BarChart3,
      },
    ];
  }, [funnel, business]);

  const quickGuideCards = useMemo(() => {
    if (!funnel || !business || !ux) return [];
    return [
      {
        id: "paid-rate",
        title: "Conversión final",
        value: formatPct(funnel.conversion.visitorToPaidPct),
        helper: `De cada 100 visitantes, ${formatDecimal(funnel.conversion.visitorToPaidPct, 1)} terminan en pago.`,
        icon: CheckCircle2,
      },
      {
        id: "revenue-range",
        title: "Ingreso del período",
        value: formatCurrency(funnel.volume.grossRevenue),
        helper: `Total de ${funnel.range.days} días.`,
        icon: DollarSign,
      },
      {
        id: "retention",
        title: "Retención D30",
        value: formatPct(funnel.conversion.retentionD30Pct),
        helper: `${funnel.volume.retainedD30Users}/${funnel.volume.retentionD30Base} usuarios vuelven al mes.`,
        icon: TrendingUp,
      },
      {
        id: "poor-rate",
        title: "Calidad UX (poor)",
        value: formatPct(ux.totals.poorRatePct),
        helper: "Mientras más bajo, mejor experiencia.",
        icon: Gauge,
      },
      {
        id: "churn",
        title: "Churn mensual",
        value: formatPct(business.kpis.churnMonthlyPct),
        helper: `${business.cohorts.lostUsers}/${business.cohorts.previousActiveUsers} usuarios perdidos.`,
        icon: AlertTriangle,
      },
      {
        id: "payback",
        title: "Recuperación CAC",
        value: `${formatDecimal(business.kpis.paybackMonthsEstimate)} meses`,
        helper: "Tiempo estimado para recuperar adquisición.",
        icon: BarChart3,
      },
    ];
  }, [funnel, business, ux]);

  return (
    <AdminPageLayout
      title="Analítica del negocio"
      subtitle="Mide conversión, ingresos y señales de riesgo para priorizar mejoras de UX y crecimiento."
      toolbar={toolbar}
    >
      <section className="analytics-dashboard">
        {error && (
          <div className="analytics-alert analytics-alert--error" role="alert">
            {error}
          </div>
        )}

        {funnel && business && ux && (
          <section className="analytics-guide">
            <header className="analytics-guide__head">
              <h2>
                <CircleHelp size={16} />
                Cómo leer este panel
              </h2>
              <p>
                1) Revisa conversión e ingreso. 2) Detecta dónde cae el embudo. 3) Valida si UX está frenando pagos.
              </p>
            </header>
            <div className="analytics-guide__cards">
              {quickGuideCards.map((card) => (
                <article key={card.id} className="analytics-guide-card">
                  <header>
                    <span>{card.title}</span>
                    <card.icon size={15} />
                  </header>
                  <strong>{card.value}</strong>
                  <small>{card.helper}</small>
                </article>
              ))}
            </div>
          </section>
        )}

        {alerts && alerts.alerts.length > 0 && (
          <section className="analytics-alerts-stack">
            {alerts.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`analytics-alert analytics-alert--${alert.severity}`}
                role={alert.severity === "critical" ? "alert" : "status"}
              >
                <header>
                  <strong>{alert.title}</strong>
                  <span>
                    {alert.metric}: {formatDecimal(alert.value)} (umbral {formatDecimal(alert.threshold)})
                  </span>
                </header>
                <p>{alert.message}</p>
                <small>{alert.recommendation}</small>
              </div>
            ))}
          </section>
        )}

        {loading && !funnel ? (
          <div className="analytics-loading">
            <Spinner size={3} width={0.3} color="var(--app-accent)" />
            <p>Calculando métricas...</p>
          </div>
        ) : (
          <>
            {funnel && business && ux && (
              <>
                <div className="analytics-kpi-grid">
                  {kpiCards.map((card) => (
                    <article key={card.id} className="analytics-kpi-card">
                      <header>
                        <span>{card.label}</span>
                        <card.icon size={16} />
                      </header>
                      <strong>{card.value}</strong>
                      <small>{card.helper}</small>
                    </article>
                  ))}
                </div>

                <div className="analytics-panels">
                  <section className="analytics-panel">
                    <h2>Actividad diaria del embudo</h2>
                    <p>
                      Evolución por día del período seleccionado:{" "}
                      {new Date(funnel.range.start).toLocaleDateString("es-MX")} a{" "}
                      {new Date(funnel.range.end).toLocaleDateString("es-MX")}.
                    </p>
                    <div className="analytics-table-wrap" tabIndex={0} aria-label="Tabla: serie diaria (desplazable)">
                      <table>
                        <thead>
                          <tr>
                            <th>Día</th>
                            <th>Visitantes</th>
                            <th>Registros</th>
                            <th>Checkout</th>
                            <th>Pagos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {series.length === 0 ? (
                            <tr>
                              <td colSpan={5}>Sin eventos para este rango.</td>
                            </tr>
                          ) : (
                            series.map((point) => (
                              <tr key={point.day}>
                                <td>{point.day}</td>
                                <td>{point.visitors.toLocaleString("es-MX")}</td>
                                <td>{point.registrations.toLocaleString("es-MX")}</td>
                                <td>{point.checkoutStarted.toLocaleString("es-MX")}</td>
                                <td>{point.purchases.toLocaleString("es-MX")}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="analytics-panel">
                    <h2>Canales que traen clientes</h2>
                    <p>Compara qué fuente/campaña trae más visitas, registros y pagos.</p>
                    <div className="analytics-table-wrap" tabIndex={0} aria-label="Tabla: atribución por canal (desplazable)">
                      <table>
                        <thead>
                          <tr>
                            <th>Fuente</th>
                            <th>Campaña</th>
                            <th>Visitantes</th>
                            <th>Registros</th>
                            <th>Checkout</th>
                            <th>Pagos</th>
                            <th>Ingreso</th>
                            <th>AOV</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attribution.length === 0 ? (
                            <tr>
                              <td colSpan={8}>Aún no hay atribución capturada.</td>
                            </tr>
                          ) : (
                            attribution.map((item) => (
                              <tr key={`${item.source}:${item.campaign}:${item.medium}`}>
                                <td>{item.source}</td>
                                <td>{item.campaign}</td>
                                <td>{item.visitors.toLocaleString("es-MX")}</td>
                                <td>{item.registrations.toLocaleString("es-MX")}</td>
                                <td>{item.checkouts.toLocaleString("es-MX")}</td>
                                <td>{item.purchases.toLocaleString("es-MX")}</td>
                                <td>{formatCurrency(item.revenue)}</td>
                                <td>{formatCurrency(item.aov)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="analytics-panel">
                    <h2>Por qué cancelan</h2>
                    <p>Motivos principales y campañas asociadas de los últimos {rangeDays} días.</p>
                    <div className="analytics-table-wrap" tabIndex={0} aria-label="Tabla: cancelaciones (desplazable)">
                      <table>
                        <thead>
                          <tr>
                            <th>Motivo</th>
                            <th>Cancelaciones</th>
                            <th>Top campañas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!cancellations || cancellations.reasons.length === 0 ? (
                            <tr>
                              <td colSpan={3}>Aún no hay cancelaciones registradas en este rango.</td>
                            </tr>
                          ) : (
                            cancellations.reasons.map((reason) => (
                              <tr key={reason.reasonCode}>
                                <td>{formatCancellationReason(reason.reasonCode)}</td>
                                <td>{reason.cancellations.toLocaleString("es-MX")}</td>
                                <td>
                                  {reason.topCampaigns.length === 0 ? (
                                    "—"
                                  ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                      {reason.topCampaigns.map((campaign) => (
                                        <span
                                          key={`${reason.reasonCode}:${campaign.source}:${campaign.campaign}:${campaign.medium}`}
                                        >
                                          {campaign.source}/{campaign.campaign} ({campaign.cancellations.toLocaleString("es-MX")})
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {cancellations && cancellations.totalCancellations > 0 ? (
                      <small style={{ display: "block", marginTop: 8, color: "var(--ad-text-muted)", fontWeight: 700 }}>
                        Voluntarias: {cancellations.voluntaryCancellations.toLocaleString("es-MX")} · Involuntarias:{" "}
                        {cancellations.involuntaryCancellations.toLocaleString("es-MX")} · Total:{" "}
                        {cancellations.totalCancellations.toLocaleString("es-MX")}
                      </small>
                    ) : null}
                  </section>

                  <section className="analytics-panel">
                    <h2>Rentabilidad (unidad económica)</h2>
                    <p>Indicadores para decidir si adquisición y monetización son sostenibles.</p>
                    <div className="analytics-table-wrap" tabIndex={0} aria-label="Tabla: unidad económica (desplazable)">
                      <table>
                        <tbody>
                          <tr>
                            <th>Ingreso recurrente mensual estimado (MRR)</th>
                            <td>{formatCurrency(business.kpis.monthlyRecurringRevenueEstimate)}</td>
                          </tr>
                          <tr>
                            <th>Ingreso promedio por usuario (ARPU, rango)</th>
                            <td>{formatCurrency(business.kpis.arpu)}</td>
                          </tr>
                          <tr>
                            <th>Ingreso promedio mensual por usuario (ARPU 30d)</th>
                            <td>{formatCurrency(business.kpis.monthlyArpuEstimate)}</td>
                          </tr>
                          <tr>
                            <th>LTV estimado</th>
                            <td>{formatCurrency(business.kpis.ltvEstimate)}</td>
                          </tr>
                          <tr>
                            <th>CAC estimado</th>
                            <td>{formatCurrency(business.kpis.cacEstimate)}</td>
                          </tr>
                          <tr>
                            <th>Payback estimado (recuperación CAC)</th>
                            <td>{formatDecimal(business.kpis.paybackMonthsEstimate)} meses</td>
                          </tr>
                          <tr>
                            <th>Tasa de reembolso/cancelación</th>
                            <td>{formatPct(business.kpis.refundRatePct)}</td>
                          </tr>
                          <tr>
                            <th>Tasa de recompra</th>
                            <td>{formatPct(business.kpis.repeatPurchaseRatePct)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="analytics-panel">
                    <h2>Experiencia del sitio (Web Vitals)</h2>
                    <p>Calidad por ruta y dispositivo para detectar fricción real en conversión.</p>
                    <div className="analytics-table-wrap" tabIndex={0} aria-label="Tabla: resumen de Web Vitals (desplazable)">
                      <table>
                        <tbody>
                          <tr>
                            <th>Sesiones medidas</th>
                            <td>{ux.totals.samples.toLocaleString("es-MX")}</td>
                          </tr>
                          <tr>
                            <th>Rate “poor”</th>
                            <td>{formatPct(ux.totals.poorRatePct)}</td>
                          </tr>
                          <tr>
                            <th>LCP promedio</th>
                            <td>{formatDecimal(ux.totals.lcpAvg)} ms</td>
                          </tr>
                          <tr>
                            <th>CLS promedio</th>
                            <td>{formatDecimal(ux.totals.clsAvg, 4)}</td>
                          </tr>
                          <tr>
                            <th>INP/FID promedio</th>
                            <td>{formatDecimal(ux.totals.inpAvg)} ms</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="analytics-table-wrap" tabIndex={0} aria-label="Tabla: Web Vitals por ruta (desplazable)">
                      <table>
                        <thead>
                          <tr>
                            <th>Ruta</th>
                            <th>Muestras</th>
                            <th>Poor %</th>
                            <th>LCP</th>
                            <th>CLS</th>
                            <th>INP/FID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ux.routes.length === 0 ? (
                            <tr>
                              <td colSpan={6}>Aún no hay Web Vitals registrados.</td>
                            </tr>
                          ) : (
                            ux.routes.map((item) => (
                              <tr key={item.pagePath}>
                                <td>{item.pagePath}</td>
                                <td>{item.samples.toLocaleString("es-MX")}</td>
                                <td>{formatPct(item.poorRatePct)}</td>
                                <td>{formatDecimal(item.lcpAvg)}</td>
                                <td>{formatDecimal(item.clsAvg, 4)}</td>
                                <td>{formatDecimal(item.inpAvg)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="analytics-table-wrap" tabIndex={0} aria-label="Tabla: Web Vitals por dispositivo (desplazable)">
                      <table>
                        <thead>
                          <tr>
                            <th>Dispositivo</th>
                            <th>Muestras</th>
                            <th>Poor %</th>
                            <th>LCP</th>
                            <th>CLS</th>
                            <th>INP/FID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ux.devices.length === 0 ? (
                            <tr>
                              <td colSpan={6}>Sin datos por dispositivo.</td>
                            </tr>
                          ) : (
                            ux.devices.map((item) => (
                              <tr key={item.deviceCategory}>
                                <td>{item.deviceCategory}</td>
                                <td>{item.samples.toLocaleString("es-MX")}</td>
                                <td>{formatPct(item.poorRatePct)}</td>
                                <td>{formatDecimal(item.lcpAvg)}</td>
                                <td>{formatDecimal(item.clsAvg, 4)}</td>
                                <td>{formatDecimal(item.inpAvg)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="analytics-panel">
                    <h2>Eventos más usados</h2>
                    <p>Verifica qué acciones del producto ocurren más seguido en el período.</p>
                    <div className="analytics-table-wrap" tabIndex={0} aria-label="Tabla: top eventos (desplazable)">
                      <table>
                        <thead>
                          <tr>
                            <th>Evento</th>
                            <th>Categoría</th>
                            <th>Total</th>
                            <th>Visitantes</th>
                            <th>Sesiones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topEvents.length === 0 ? (
                            <tr>
                              <td colSpan={5}>Sin eventos en el rango seleccionado.</td>
                            </tr>
                          ) : (
                            topEvents.map((item) => (
                              <tr key={`${item.eventName}:${item.eventCategory}`}>
                                <td>{item.eventName}</td>
                                <td>{item.eventCategory}</td>
                                <td>{item.totalEvents.toLocaleString("es-MX")}</td>
                                <td>{item.uniqueVisitors.toLocaleString("es-MX")}</td>
                                <td>{item.uniqueSessions.toLocaleString("es-MX")}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>

                <section className="analytics-foot">
                  <p>
                    Retención D30: {formatPct(funnel.conversion.retentionD30Pct)} (
                    {funnel.volume.retainedD30Users}/{funnel.volume.retentionD30Base})
                  </p>
                  <p>
                    Churn mensual ({business.range.churnWindowDays}d):{" "}
                    {formatPct(business.kpis.churnMonthlyPct)} · New users:{" "}
                    {business.cohorts.newUsers.toLocaleString("es-MX")}
                  </p>
                </section>
              </>
            )}
          </>
        )}
      </section>
    </AdminPageLayout>
  );
}
