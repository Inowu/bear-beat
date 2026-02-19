import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, BarChart3, CalendarClock, CheckCircle2, CircleHelp, CreditCard, DollarSign, Gauge, RefreshCw, TrendingUp, UserPlus, Users, } from "src/icons";
import trpc from "../../../api";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import Pagination from "../../../components/Pagination/Pagination";
import { Button, Input, Select, SkeletonRow, SkeletonTable } from "../../../components/ui";
import "./AnalyticsDashboard.scss";

interface FunnelOverview {
  range: {
    days: number;
    start: string;
    end: string;
  };
  volume: {
    visitors: number;
    lpToRegister: number;
    registrations: number;
    checkoutStarted: number;
    eventPayments: number;
    paymentSuccessEvents: number;
    paymentSuccessRenewals: number;
    paymentSuccessWithoutOrderId: number;
    paidOrders: number;
    paidUsers: number;
    grossRevenue: number;
    chatOpened: number;
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
  paymentReconciliation: {
    paidOrdersDb: number;
    paymentSuccessEvents: number;
    delta: number;
    deltaPct: number;
    likelyCauses: string[];
  };
  checkoutRecovery: {
    abandonmentWindowMinMinutes: number;
    abandonmentWindowMaxMinutes: number;
    checkoutAttempts: number;
    paidWithin30m: number;
    abandonedNoPayment: number;
    pendingUnder10m: number;
    paymentFailedEvents: number;
    topPaymentFailedReasons: Array<{
      reasonCode: string;
      total: number;
    }>;
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
    activeSubscribersNow: number;
    activeSubscribersWithPlanNow: number;
    mrrActiveSubscriptionsMxn: number;
    mrrActiveSubscriptionsUsd: number;
    arrActiveSubscriptionsMxn: number;
    arrActiveSubscriptionsUsd: number;
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

interface AdSpendMonthlyRow {
  id: number;
  month: string;
  channel: string;
  currency: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

interface AdSpendMonthlyAcquisitionRow {
  channel: string;
  newPaidUsers: number;
}

interface AdSpendMonthlyResponse {
  month: string;
  range: {
    start: string;
    end: string;
  };
  spend: AdSpendMonthlyRow[];
  acquisition: AdSpendMonthlyAcquisitionRow[];
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
  routesTotal: number;
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

interface PaginatedResult<T> {
  total: number;
  data: T[];
}

const ANALYTICS_KPI_SKELETON_COUNT = 9;
const ANALYTICS_PANEL_SKELETON_COUNT = 8;
const ANALYTICS_TABLE_SKELETON_ROWS = 5;

function AnalyticsDashboardSkeleton() {
  return (
    <div className="analytics-skeleton-layout" role="status" aria-live="polite">
      <span className="sr-only">Actualizando métricas</span>

      <section className="analytics-guide analytics-guide--skeleton" aria-hidden="true">
        <div className="analytics-skeleton-line analytics-skeleton-line--title" />
        <div className="analytics-skeleton-line analytics-skeleton-line--text" />
        <div className="analytics-skeleton-line analytics-skeleton-line--text analytics-skeleton-line--short" />
      </section>

      <div className="analytics-kpi-grid" aria-hidden="true">
        {Array.from({ length: ANALYTICS_KPI_SKELETON_COUNT }).map((_, idx) => (
          <article key={`kpi-skeleton-${idx}`} className="analytics-kpi-card analytics-kpi-card--skeleton">
            <div className="analytics-skeleton-line analytics-skeleton-line--label" />
            <div className="analytics-skeleton-line analytics-skeleton-line--value" />
            <div className="analytics-skeleton-line analytics-skeleton-line--helper" />
          </article>
        ))}
      </div>

      <div className="analytics-panels analytics-panels--skeleton" aria-hidden="true">
        {Array.from({ length: ANALYTICS_PANEL_SKELETON_COUNT }).map((_, panelIdx) => (
          <section key={`panel-skeleton-${panelIdx}`} className="analytics-panel analytics-panel--skeleton">
            <div className="analytics-skeleton-line analytics-skeleton-line--panel-title" />
            <div className="analytics-skeleton-line analytics-skeleton-line--panel-text" />
            <div className="analytics-skeleton-table">
              {Array.from({ length: ANALYTICS_TABLE_SKELETON_ROWS }).map((__, rowIdx) => (
                <div key={`row-${panelIdx}-${rowIdx}`} className="analytics-skeleton-table__row">
                  <div className="analytics-skeleton-line analytics-skeleton-line--cell" />
                  <div className="analytics-skeleton-line analytics-skeleton-line--cell analytics-skeleton-line--short" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
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

const PAYMENT_FAILURE_REASON_LABELS: Record<string, string> = {
  "3ds_authentication_required": "3DS requerido",
  "network_error": "Error de red",
  "payment_intent_failed": "Intento de pago fallido",
  "past_due": "Pago vencido",
  "billing_subscription_payment_failed": "Fallo de cobro de suscripción",
  "payment_sale_denied": "PayPal rechazó el cobro",
  "incomplete_expired": "Intento expirado",
  "order_expired": "Orden expirada",
};

function formatCancellationReason(code: string): string {
  const normalized = (code || "").trim();
  return CANCELLATION_REASON_LABELS[normalized] ?? normalized ?? "—";
}

function formatPaymentFailureReason(code: string): string {
  const normalized = (code || "").trim();
  if (!normalized) return "Desconocido";
  return PAYMENT_FAILURE_REASON_LABELS[normalized] ?? normalized.replace(/_/g, " ");
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

function formatCurrencyCode(value: number | null | undefined, currency: string): string {
  if (value == null || Number.isNaN(value)) return "—";
  const code = (currency || "MXN").toUpperCase();
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrencyPair(mxn: number, usd: number): string {
  const parts: string[] = [];
  if (mxn > 0) parts.push(`MXN ${formatCurrencyCode(mxn, "MXN")}`);
  if (usd > 0) parts.push(`USD ${formatCurrencyCode(usd, "USD")}`);
  return parts.length ? parts.join(" · ") : "—";
}

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatSignedNumber(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("es-MX")}`;
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

function formatRangeWindow(days: number): string {
  return days <= 1 ? "24 horas" : `${days} días`;
}

function formatRecentWindow(days: number): string {
  return days <= 1 ? "últimas 24 horas" : `últimos ${days} días`;
}

function normalizeChannelKey(value: string): string {
  return (value || "").trim().toLowerCase();
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
  const [attributionTotal, setAttributionTotal] = useState<number>(0);
  const [attributionPage, setAttributionPage] = useState<number>(0);
  const [attributionLimit] = useState<number>(50);
  const [hideSourcesWithoutPayments, setHideSourcesWithoutPayments] =
    useState<boolean>(false);
  const [cancellations, setCancellations] = useState<CancellationReasonsSnapshot | null>(null);
  const [business, setBusiness] = useState<BusinessMetrics | null>(null);
  const [ux, setUx] = useState<UxSummary | null>(null);
  const [topEvents, setTopEvents] = useState<TopEventPoint[]>([]);
  const [topEventsTotal, setTopEventsTotal] = useState<number>(0);
  const [topEventsPage, setTopEventsPage] = useState<number>(0);
  const [topEventsLimit] = useState<number>(50);
  const [uxRoutesPage, setUxRoutesPage] = useState<number>(0);
  const [uxRoutesLimit] = useState<number>(50);
  const [alerts, setAlerts] = useState<HealthAlertsSnapshot | null>(null);

  const [adSpendMonth, setAdSpendMonth] = useState<string>(() => {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  });
  const [adSpendMonthly, setAdSpendMonthly] = useState<AdSpendMonthlyResponse | null>(null);
  const [adSpendMonthlyLoading, setAdSpendMonthlyLoading] = useState<boolean>(false);
  const [adSpendMonthlyError, setAdSpendMonthlyError] = useState<string>("");
  const [adSpendDraft, setAdSpendDraft] = useState<Record<number, string>>({});
  const [newSpendChannel, setNewSpendChannel] = useState<string>("");
  const [newSpendCurrency, setNewSpendCurrency] = useState<"MXN" | "USD">("MXN");
  const [newSpendAmount, setNewSpendAmount] = useState<string>("");

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
        trpc.analytics.getAnalyticsAttribution.query({
          days: rangeDays,
          limit: attributionLimit,
          page: attributionPage,
        }),
        trpc.analytics.getAnalyticsCancellationReasons.query({ days: rangeDays, topCampaigns: 5 }),
        trpc.analytics.getAnalyticsBusinessMetrics.query({ days: rangeDays, adSpend }),
        trpc.analytics.getAnalyticsUxQuality.query({
          days: rangeDays,
          routesLimit: uxRoutesLimit,
          routesPage: uxRoutesPage,
        }),
        trpc.analytics.getAnalyticsTopEvents.query({
          days: rangeDays,
          limit: topEventsLimit,
          page: topEventsPage,
        }),
        trpc.analytics.getAnalyticsAlerts.query({ days: rangeDays }),
      ]);

      setFunnel(funnelResponse as FunnelOverview);
      setSeries(seriesResponse as DailyPoint[]);
      const attributionPaged = attributionResponse as PaginatedResult<AttributionPoint>;
      setAttribution(attributionPaged.data);
      setAttributionTotal(attributionPaged.total);
      setCancellations(cancellationsResponse as CancellationReasonsSnapshot);
      setBusiness(businessResponse as BusinessMetrics);
      setUx(uxResponse as UxSummary);
      const topEventsPaged = topEventsResponse as PaginatedResult<TopEventPoint>;
      setTopEvents(topEventsPaged.data);
      setTopEventsTotal(topEventsPaged.total);
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
  }, [
    rangeDays,
    manualAdSpend,
    attributionLimit,
    attributionPage,
    uxRoutesLimit,
    uxRoutesPage,
    topEventsLimit,
    topEventsPage,
  ]);

  const fetchAdSpendMonthly = useCallback(async () => {
    setAdSpendMonthlyLoading(true);
    setAdSpendMonthlyError("");
    try {
      const response = (await trpc.analytics.getAnalyticsAdSpendMonthly.query({
        month: adSpendMonth,
      })) as AdSpendMonthlyResponse;
      setAdSpendMonthly(response);

      const nextDraft: Record<number, string> = {};
      for (const row of response?.spend ?? []) {
        nextDraft[row.id] = String(row.amount ?? "");
      }
      setAdSpendDraft(nextDraft);
    } catch (fetchError) {
      setAdSpendMonthly(null);
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "No fue posible cargar Ad Spend.";
      setAdSpendMonthlyError(message);
    } finally {
      setAdSpendMonthlyLoading(false);
    }
  }, [adSpendMonth]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    void fetchAdSpendMonthly();
  }, [fetchAdSpendMonthly]);

  const saveAdSpendRow = async (opts: { channel: string; currency: "MXN" | "USD"; amount: number }) => {
    await trpc.analytics.upsertAnalyticsAdSpendMonthly.mutate({
      month: adSpendMonth,
      channel: opts.channel,
      currency: opts.currency,
      amount: opts.amount,
    });
    await fetchAdSpendMonthly();
  };

  const deleteAdSpendRow = async (id: number) => {
    await trpc.analytics.deleteAnalyticsAdSpendMonthly.mutate({ id });
    await fetchAdSpendMonthly();
  };

  const toolbar = (
    <div className="flex flex-wrap items-end gap-2 w-full">
      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[220px]">
        Ventana de análisis
        <Select
          value={rangeDays}
          onChange={(event) => {
            // Reset pagination to keep tables stable when the window changes.
            setRangeDays(Number(event.target.value));
            setAttributionPage(0);
            setTopEventsPage(0);
            setUxRoutesPage(0);
          }}
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>

      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[220px]">
        Ad Spend manual (MXN)
        <Input
          type="number"
          min={0}
          step={0.01}
          value={manualAdSpend}
          onChange={(event) => setManualAdSpend(event.target.value)}
          placeholder="Opcional"
        />
      </label>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-2 min-h-[44px] rounded-xl px-3 border border-border bg-bg-card text-text-muted text-sm font-medium"
          role="status"
        >
          <CalendarClock size={16} aria-hidden />
          Actualizado: {formatDateTime(lastUpdatedAt)}
        </span>
        <Button unstyled
          type="button"
          onClick={() => void fetchAnalytics()}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-bear-gradient text-bear-dark-500 hover:opacity-95 font-medium rounded-pill px-4 py-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden />
          {loading ? "Actualizando..." : "Actualizar"}
        </Button>
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
        label: "Órdenes pagadas (DB)",
        value: formatCompactNumber(funnel.volume.paidOrders),
        helper: `Eventos: ${formatCompactNumber(funnel.volume.paymentSuccessEvents)} · Δ ${formatSignedNumber(
          funnel.paymentReconciliation.delta,
        )}`,
        icon: Activity,
      },
      {
        id: "revenue",
        label: "Ingreso bruto",
        value: formatCurrency(funnel.volume.grossRevenue),
        helper: formatRangeWindow(funnel.range.days),
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

  const acquisitionByChannel = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of adSpendMonthly?.acquisition ?? []) {
      map.set(normalizeChannelKey(row.channel), row.newPaidUsers);
    }
    return map;
  }, [adSpendMonthly]);

  const quickGuideCards = useMemo(() => {
    if (!funnel || !business || !ux) return [];
    const hasUxSamples = ux.totals.samples > 0;
    const hasPaybackEstimate =
      business.kpis.paybackMonthsEstimate != null &&
      Number.isFinite(business.kpis.paybackMonthsEstimate);

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
        helper: `Total de ${formatRangeWindow(funnel.range.days)}.`,
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
        value: hasUxSamples
          ? formatPct(ux.totals.poorRatePct)
          : "Sin datos suficientes",
        helper: hasUxSamples
          ? "Mientras más bajo, mejor experiencia."
          : "Aún no hay sesiones medidas en el rango.",
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
        value: hasPaybackEstimate
          ? `${formatDecimal(business.kpis.paybackMonthsEstimate)} meses`
          : "N/A",
        helper: hasPaybackEstimate
          ? "Tiempo estimado para recuperar adquisición."
          : "Sin datos suficientes para estimar payback.",
        icon: BarChart3,
      },
    ];
  }, [funnel, business, ux]);

  const attributionVisible = useMemo(() => {
    if (!hideSourcesWithoutPayments) return attribution;
    return attribution.filter((item) => item.purchases > 0);
  }, [attribution, hideSourcesWithoutPayments]);

  const showInitialSkeleton = loading && (!funnel || !business || !ux);

  return (
    <AdminPageLayout
      title="Analítica del negocio"
      subtitle="Mide conversión, ingresos y señales de riesgo para priorizar mejoras de UX y crecimiento."
      toolbar={toolbar}
    >
      <section
        className={[
          "analytics-dashboard",
          "analytics-dashboard--biz",
          showInitialSkeleton ? "" : "bb-skeleton-fade-in",
        ]
          .filter(Boolean)
          .join(" ")}
      >
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

        {showInitialSkeleton ? (
          <AnalyticsDashboardSkeleton />
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
                    <h2>Reconciliación de pagos (DB vs Events)</h2>
                    <p>
                      Compara órdenes pagadas en base de datos contra eventos <code>payment_success</code> instrumentados
                      en backend.
                    </p>
                    <div className="analytics-table-wrap" tabIndex={0} aria-label="Tabla: reconciliación de pagos (desplazable)">
                      <table>
                        <tbody>
                          <tr>
                            <th>Paid Orders (DB)</th>
                            <td>{funnel.paymentReconciliation.paidOrdersDb.toLocaleString("es-MX")}</td>
                          </tr>
                          <tr>
                            <th>Payment Success (Events)</th>
                            <td>{funnel.paymentReconciliation.paymentSuccessEvents.toLocaleString("es-MX")}</td>
                          </tr>
                          <tr>
                            <th>Diferencia (Events - DB)</th>
                            <td>
                              {formatSignedNumber(funnel.paymentReconciliation.delta)} (
                              {formatPct(funnel.paymentReconciliation.deltaPct)})
                            </td>
                          </tr>
                          <tr>
                            <th>Eventos marcados como renovación</th>
                            <td>{funnel.volume.paymentSuccessRenewals.toLocaleString("es-MX")}</td>
                          </tr>
                          <tr>
                            <th>Eventos sin order_id</th>
                            <td>{funnel.volume.paymentSuccessWithoutOrderId.toLocaleString("es-MX")}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="admin-mobile-list" aria-label="Reconciliación de pagos (móvil)">
                      <article className="admin-mobile-card">
                        <header className="analytics-mobile-card__head">
                          <div className="analytics-mobile-card__copy">
                            <p className="analytics-mobile-card__title">DB vs Events</p>
                            <p className="analytics-mobile-card__subtitle">{formatRangeWindow(rangeDays)}</p>
                          </div>
                        </header>
                        <dl className="analytics-mobile-kv">
                          <div className="analytics-mobile-kv__row">
                            <dt>Paid Orders (DB)</dt>
                            <dd>{funnel.paymentReconciliation.paidOrdersDb.toLocaleString("es-MX")}</dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>Payment Success (Events)</dt>
                            <dd>{funnel.paymentReconciliation.paymentSuccessEvents.toLocaleString("es-MX")}</dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>Delta</dt>
                            <dd>
                              {formatSignedNumber(funnel.paymentReconciliation.delta)} (
                              {formatPct(funnel.paymentReconciliation.deltaPct)})
                            </dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>Renovaciones (events)</dt>
                            <dd>{funnel.volume.paymentSuccessRenewals.toLocaleString("es-MX")}</dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>Sin order_id</dt>
                            <dd>{funnel.volume.paymentSuccessWithoutOrderId.toLocaleString("es-MX")}</dd>
                          </div>
                        </dl>
                      </article>
                    </div>
                    {funnel.paymentReconciliation.likelyCauses.length > 0 ? (
                      <small style={{ display: "block", marginTop: 8, color: "var(--ad-text-muted)", fontWeight: 700 }}>
                        {funnel.paymentReconciliation.likelyCauses.join(" · ")}
                      </small>
                    ) : null}
                    <h3 style={{ marginTop: 20, marginBottom: 6 }}>Checkout recovery (10–30 min)</h3>
                    <p style={{ marginTop: 0 }}>
                      Ventana de abandono: {funnel.checkoutRecovery.abandonmentWindowMinMinutes}–
                      {funnel.checkoutRecovery.abandonmentWindowMaxMinutes} min sin <code>payment_success</code>.
                    </p>
                    <div className="analytics-table-wrap" tabIndex={0} aria-label="Tabla: checkout recovery (desplazable)">
                      <table>
                        <tbody>
                          <tr>
                            <th>Checkouts analizados</th>
                            <td>{funnel.checkoutRecovery.checkoutAttempts.toLocaleString("es-MX")}</td>
                          </tr>
                          <tr>
                            <th>Pago dentro de 30 min</th>
                            <td>{funnel.checkoutRecovery.paidWithin30m.toLocaleString("es-MX")}</td>
                          </tr>
                          <tr>
                            <th>Sin pago (abandono)</th>
                            <td>{funnel.checkoutRecovery.abandonedNoPayment.toLocaleString("es-MX")}</td>
                          </tr>
                          <tr>
                            <th>Pendiente &lt;10 min</th>
                            <td>{funnel.checkoutRecovery.pendingUnder10m.toLocaleString("es-MX")}</td>
                          </tr>
                          <tr>
                            <th>Eventos payment_failed</th>
                            <td>{funnel.checkoutRecovery.paymentFailedEvents.toLocaleString("es-MX")}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {funnel.checkoutRecovery.topPaymentFailedReasons.length > 0 ? (
                      <div style={{ marginTop: 10 }}>
                        <strong style={{ display: "block", marginBottom: 6 }}>Razones de fallo más frecuentes</strong>
                        <div className="analytics-table-wrap" tabIndex={0} aria-label="Tabla: razones de payment_failed (desplazable)">
                          <table>
                            <thead>
                              <tr>
                                <th>Razón</th>
                                <th>Eventos</th>
                              </tr>
                            </thead>
                            <tbody>
                              {funnel.checkoutRecovery.topPaymentFailedReasons.map((item) => (
                                <tr key={item.reasonCode}>
                                  <td>{formatPaymentFailureReason(item.reasonCode)}</td>
                                  <td>{item.total.toLocaleString("es-MX")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </section>

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
                    <div className="admin-mobile-list" aria-label="Serie diaria (móvil)">
                      {series.length === 0 ? (
                        <div className="admin-mobile-empty">
                          <h2>Sin eventos</h2>
                          <p>Sin eventos para este rango.</p>
                        </div>
                      ) : (
                        series.map((point) => (
                          <article key={`m_series_${point.day}`} className="admin-mobile-card">
                            <header className="analytics-mobile-card__head">
                              <div className="analytics-mobile-card__copy">
                                <p className="analytics-mobile-card__title">{point.day}</p>
                              </div>
                            </header>
                            <dl className="analytics-mobile-kv">
                              <div className="analytics-mobile-kv__row">
                                <dt>Visitantes</dt>
                                <dd>{point.visitors.toLocaleString("es-MX")}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>Registros</dt>
                                <dd>{point.registrations.toLocaleString("es-MX")}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>Checkout</dt>
                                <dd>{point.checkoutStarted.toLocaleString("es-MX")}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>Pagos</dt>
                                <dd>{point.purchases.toLocaleString("es-MX")}</dd>
                              </div>
                            </dl>
                          </article>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="analytics-panel">
                    <h2>Canales que traen clientes</h2>
                    <p>Compara qué fuente/campaña trae más visitas, registros y pagos.</p>
                    <div className="analytics-panel__controls">
                      <label className="analytics-checkbox">
                        <Input
                          type="checkbox"
                          checked={hideSourcesWithoutPayments}
                          onChange={(event) =>
                            setHideSourcesWithoutPayments(event.target.checked)
                          }
                        />
                        <span>Ocultar fuentes sin pagos</span>
                      </label>
                    </div>
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
                          {attributionVisible.length === 0 ? (
                            <tr>
                              <td colSpan={8}>
                                {attribution.length === 0
                                  ? "Aún no hay atribución capturada."
                                  : "No hay fuentes con pagos en esta página."}
                              </td>
                            </tr>
                          ) : (
                            attributionVisible.map((item) => (
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
                    <div className="admin-mobile-list" aria-label="Atribución por canal (móvil)">
                      {attributionVisible.length === 0 ? (
                        <div className="admin-mobile-empty">
                          <h2>
                            {attribution.length === 0
                              ? "Sin atribución"
                              : "Sin fuentes con pagos"}
                          </h2>
                          <p>
                            {attribution.length === 0
                              ? "Aún no hay atribución capturada."
                              : "Activa \"Ocultar fuentes sin pagos\" y esta página quedó sin resultados."}
                          </p>
                        </div>
                      ) : (
                        attributionVisible.map((item) => (
                          <article
                            key={`m_attr_${item.source}:${item.campaign}:${item.medium}`}
                            className="admin-mobile-card"
                          >
                            <header className="analytics-mobile-card__head">
                              <div className="analytics-mobile-card__copy">
                                <p className="analytics-mobile-card__title">{item.source}</p>
                                <p className="analytics-mobile-card__subtitle">
                                  {item.campaign || "—"}
                                  {item.medium ? ` · ${item.medium}` : ""}
                                </p>
                              </div>
                            </header>
                            <dl className="analytics-mobile-kv">
                              <div className="analytics-mobile-kv__row">
                                <dt>Visitantes</dt>
                                <dd>{item.visitors.toLocaleString("es-MX")}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>Registros</dt>
                                <dd>{item.registrations.toLocaleString("es-MX")}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>Checkout</dt>
                                <dd>{item.checkouts.toLocaleString("es-MX")}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>Pagos</dt>
                                <dd>{item.purchases.toLocaleString("es-MX")}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>Ingreso</dt>
                                <dd>{formatCurrency(item.revenue)}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>AOV</dt>
                                <dd>{formatCurrency(item.aov)}</dd>
                              </div>
                            </dl>
                          </article>
                        ))
                      )}
                    </div>
                    <Pagination
                      title="canales"
                      totalData={attributionTotal}
                      totalLoader={loading}
                      startFilter={(_key, value) =>
                        setAttributionPage(typeof value === "number" ? value : Number(value))
                      }
                      currentPage={attributionPage}
                      limit={attributionLimit}
                    />
                  </section>

                  <section className="analytics-panel">
                    <h2>Por qué cancelan</h2>
                    <p>Motivos principales y campañas asociadas de {formatRecentWindow(rangeDays)}.</p>
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
                    <div className="admin-mobile-list" aria-label="Cancelaciones (móvil)">
                      {!cancellations || cancellations.reasons.length === 0 ? (
                        <div className="admin-mobile-empty">
                          <h2>Sin cancelaciones</h2>
                          <p>Aún no hay cancelaciones registradas en este rango.</p>
                        </div>
                      ) : (
                        cancellations.reasons.map((reason) => (
                          <article key={`m_cancel_${reason.reasonCode}`} className="admin-mobile-card">
                            <header className="analytics-mobile-card__head">
                              <div className="analytics-mobile-card__copy">
                                <p className="analytics-mobile-card__title">
                                  {formatCancellationReason(reason.reasonCode)}
                                </p>
                                <p className="analytics-mobile-card__subtitle">
                                  {reason.cancellations.toLocaleString("es-MX")} cancelaciones
                                </p>
                              </div>
                            </header>
                            {reason.topCampaigns.length > 0 ? (
                              <div className="analytics-mobile-lines" aria-label="Top campañas">
                                {reason.topCampaigns.map((campaign) => (
                                  <p
                                    key={`m_cancel_${reason.reasonCode}:${campaign.source}:${campaign.campaign}:${campaign.medium}`}
                                    className="analytics-mobile-line"
                                  >
                                    {campaign.source}/{campaign.campaign} (
                                    {campaign.cancellations.toLocaleString("es-MX")})
                                  </p>
                                ))}
                              </div>
                            ) : null}
                          </article>
                        ))
                      )}
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
                            <th>Suscriptores activos (ahora)</th>
                            <td>
                              {business.kpis.activeSubscribersNow.toLocaleString("es-MX")}
                              {business.kpis.activeSubscribersWithPlanNow
                                ? ` (con plan: ${business.kpis.activeSubscribersWithPlanNow.toLocaleString("es-MX")})`
                                : ""}
                            </td>
                          </tr>
                          <tr>
                            <th>MRR (suscripciones activas)</th>
                            <td>
                              {formatCurrencyPair(
                                business.kpis.mrrActiveSubscriptionsMxn,
                                business.kpis.mrrActiveSubscriptionsUsd,
                              )}
                            </td>
                          </tr>
                          <tr>
                            <th>ARR (suscripciones activas)</th>
                            <td>
                              {formatCurrencyPair(
                                business.kpis.arrActiveSubscriptionsMxn,
                                business.kpis.arrActiveSubscriptionsUsd,
                              )}
                            </td>
                          </tr>
                          <tr>
                            <th>Ingresos últimos 30d (no MRR)</th>
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
                    <div className="admin-mobile-list" aria-label="Unidad económica (móvil)">
                      <article className="admin-mobile-card">
                        <header className="analytics-mobile-card__head">
                          <div className="analytics-mobile-card__copy">
                            <p className="analytics-mobile-card__title">Unidad económica</p>
                            <p className="analytics-mobile-card__subtitle">{formatRangeWindow(rangeDays)}</p>
                          </div>
                        </header>
                        <dl className="analytics-mobile-kv">
                          <div className="analytics-mobile-kv__row">
                            <dt>Suscriptores activos</dt>
                            <dd>{business.kpis.activeSubscribersNow.toLocaleString("es-MX")}</dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>MRR</dt>
                            <dd>
                              {formatCurrencyPair(
                                business.kpis.mrrActiveSubscriptionsMxn,
                                business.kpis.mrrActiveSubscriptionsUsd,
                              )}
                            </dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>ARR</dt>
                            <dd>
                              {formatCurrencyPair(
                                business.kpis.arrActiveSubscriptionsMxn,
                                business.kpis.arrActiveSubscriptionsUsd,
                              )}
                            </dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>ARPU</dt>
                            <dd>{formatCurrency(business.kpis.arpu)}</dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>ARPU 30d</dt>
                            <dd>{formatCurrency(business.kpis.monthlyArpuEstimate)}</dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>LTV</dt>
                            <dd>{formatCurrency(business.kpis.ltvEstimate)}</dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>CAC</dt>
                            <dd>{formatCurrency(business.kpis.cacEstimate)}</dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>Payback</dt>
                            <dd>{formatDecimal(business.kpis.paybackMonthsEstimate)} meses</dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>Refund</dt>
                            <dd>{formatPct(business.kpis.refundRatePct)}</dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>Recompra</dt>
                            <dd>{formatPct(business.kpis.repeatPurchaseRatePct)}</dd>
                          </div>
                        </dl>
                      </article>
                    </div>
                  </section>

                  <section className="analytics-panel">
                    <h2>Ad Spend y CAC (mensual)</h2>
                    <p>
                      Captura inversión por canal y calcula CAC usando <strong>nuevos pagos</strong> (primer{" "}
                      <code>payment_success</code> por usuario en el mes). El canal se empata por{" "}
                      <code>utm_source</code>.
                    </p>

                    <div className="flex flex-wrap items-end gap-2">
                      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[220px]">
                        Mes
                        <Input
                          type="month"
                          value={adSpendMonth}
                          onChange={(event) => setAdSpendMonth(event.target.value)}
                        />
                      </label>
                      <Button unstyled
                        type="button"
                        onClick={() => void fetchAdSpendMonthly()}
                        disabled={adSpendMonthlyLoading}
                        aria-label={adSpendMonthlyLoading ? "Actualizando ad spend mensual" : undefined}
                        className="inline-flex items-center gap-2 min-h-[44px] rounded-xl px-4 border border-border bg-bg-card text-text-main font-semibold hover:bg-bg-input transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        <RefreshCw size={16} className={adSpendMonthlyLoading ? "animate-spin" : ""} aria-hidden />
                        {adSpendMonthlyLoading ? <SkeletonRow width="68px" height="14px" /> : "Recargar"}
                      </Button>
                      <span className="text-sm text-text-muted">
                        {adSpendMonthly?.range?.start
                          ? `${new Date(adSpendMonthly.range.start).toLocaleDateString("es-MX")} → ${new Date(
                              adSpendMonthly.range.end,
                            ).toLocaleDateString("es-MX")}`
                          : null}
                      </span>
                    </div>

                    {adSpendMonthlyError ? (
                      <div className="admin-error-strip" style={{ marginTop: 12 }}>
                        <p>{adSpendMonthlyError}</p>
                      </div>
                    ) : null}

                    <div className="analytics-table-wrap" tabIndex={0} aria-label="Tabla: Ad Spend y CAC (mensual)">
                      <table>
                        <thead>
                          <tr>
                            <th>Canal (utm_source)</th>
                            <th>Moneda</th>
                            <th>Ad Spend</th>
                            <th>Nuevos pagos</th>
                            <th>CAC</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!adSpendMonthly && adSpendMonthlyLoading ? (
                            <tr>
                              <td colSpan={6}>
                                <SkeletonTable />
                              </td>
                            </tr>
                          ) : !adSpendMonthly || adSpendMonthly.spend.length === 0 ? (
                            <tr>
                              <td colSpan={6}>
                                Aún no hay inversión registrada para este mes. Agrega un canal abajo.
                              </td>
                            </tr>
                          ) : (
                            adSpendMonthly.spend.map((row) => {
                              const newPaidUsers =
                                acquisitionByChannel.get(normalizeChannelKey(row.channel)) ?? 0;
                              const amountRaw = adSpendDraft[row.id] ?? String(row.amount ?? "");
                              const amount = Number(amountRaw);
                              const amountOk =
                                amountRaw.trim() !== "" && Number.isFinite(amount) && amount >= 0;
                              const cac =
                                amountOk && newPaidUsers > 0 ? amount / newPaidUsers : null;

                              return (
                                <tr key={row.id}>
                                  <td>{row.channel}</td>
                                  <td>{row.currency}</td>
                                  <td>
                                    <Input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={amountRaw}
                                      onChange={(event) =>
                                        setAdSpendDraft((prev) => ({
                                          ...prev,
                                          [row.id]: event.target.value,
                                        }))
                                      }
                                    />
                                  </td>
                                  <td>{newPaidUsers.toLocaleString("es-MX")}</td>
                                  <td>
                                    {cac == null ? "—" : formatCurrencyCode(cac, row.currency)}
                                  </td>
                                  <td>
                                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                      <Button unstyled
                                        type="button"
                                        className="min-h-[40px] rounded-xl px-3 border border-border bg-bg-card text-text-main font-semibold hover:bg-bg-input transition-colors"
                                        onClick={async () => {
                                          try {
                                            if (!amountOk) {
                                              setAdSpendMonthlyError("Ad Spend inválido (debe ser >= 0).");
                                              return;
                                            }
                                            await saveAdSpendRow({
                                              channel: row.channel,
                                              currency: (row.currency?.toUpperCase() === "USD" ? "USD" : "MXN"),
                                              amount,
                                            });
                                            setAdSpendMonthlyError("");
                                          } catch (e) {
                                            setAdSpendMonthlyError(
                                              e instanceof Error ? e.message : "No fue posible guardar Ad Spend.",
                                            );
                                          }
                                        }}
                                      >
                                        Guardar
                                      </Button>
                                      <Button unstyled
                                        type="button"
                                        className="min-h-[40px] rounded-xl px-3 border border-border bg-bg-card text-red-600 font-semibold hover:bg-bg-input transition-colors"
                                        onClick={async () => {
                                          try {
                                            await deleteAdSpendRow(row.id);
                                            setAdSpendMonthlyError("");
                                          } catch (e) {
                                            setAdSpendMonthlyError(
                                              e instanceof Error ? e.message : "No fue posible eliminar Ad Spend.",
                                            );
                                          }
                                        }}
                                      >
                                        Eliminar
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[240px]">
                        Canal (utm_source)
                        <Input
                          type="text"
                          value={newSpendChannel}
                          onChange={(event) => setNewSpendChannel(event.target.value)}
                          placeholder="Ej: facebook, google, youtube, (direct)"
                        />
                      </label>
                      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[160px]">
                        Moneda
                        <Select
                          value={newSpendCurrency}
                          onChange={(event) =>
                            setNewSpendCurrency(event.target.value === "USD" ? "USD" : "MXN")
                          }
                        >
                          <option value="MXN">MXN</option>
                          <option value="USD">USD</option>
                        </Select>
                      </label>
                      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[200px]">
                        Ad Spend
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={newSpendAmount}
                          onChange={(event) => setNewSpendAmount(event.target.value)}
                          placeholder="0"
                        />
                      </label>
                      <Button unstyled
                        type="button"
                        className="inline-flex items-center gap-2 bg-bear-gradient text-bear-dark-500 hover:opacity-95 font-medium rounded-pill px-4 py-2 transition-colors"
                        onClick={async () => {
                          try {
                            const channel = newSpendChannel.trim();
                            const amount = Number(newSpendAmount);
                            if (!channel) {
                              setAdSpendMonthlyError("Canal requerido.");
                              return;
                            }
                            if (!Number.isFinite(amount) || amount < 0) {
                              setAdSpendMonthlyError("Ad Spend inválido (debe ser >= 0).");
                              return;
                            }
                            await saveAdSpendRow({
                              channel,
                              currency: newSpendCurrency,
                              amount,
                            });
                            setNewSpendChannel("");
                            setNewSpendAmount("");
                            setAdSpendMonthlyError("");
                          } catch (e) {
                            setAdSpendMonthlyError(
                              e instanceof Error ? e.message : "No fue posible guardar Ad Spend.",
                            );
                          }
                        }}
                      >
                        Guardar canal
                      </Button>
                    </div>

                    {adSpendMonthly?.acquisition?.length ? (
                      <small style={{ display: "block", marginTop: 10, color: "var(--ad-text-muted)", fontWeight: 700 }}>
                        Top canales (nuevos pagos):{" "}
                        {adSpendMonthly.acquisition
                          .slice(0, 8)
                          .map((row) => `${row.channel} (${row.newPaidUsers})`)
                          .join(" · ")}
                      </small>
                    ) : null}
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
                    <div className="admin-mobile-list" aria-label="Web Vitals (resumen móvil)">
                      <article className="admin-mobile-card">
                        <header className="analytics-mobile-card__head">
                          <div className="analytics-mobile-card__copy">
                            <p className="analytics-mobile-card__title">Resumen</p>
                            <p className="analytics-mobile-card__subtitle">{formatRangeWindow(rangeDays)}</p>
                          </div>
                        </header>
                        <dl className="analytics-mobile-kv">
                          <div className="analytics-mobile-kv__row">
                            <dt>Sesiones</dt>
                            <dd>{ux.totals.samples.toLocaleString("es-MX")}</dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>Poor %</dt>
                            <dd>{formatPct(ux.totals.poorRatePct)}</dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>LCP</dt>
                            <dd>{formatDecimal(ux.totals.lcpAvg)} ms</dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>CLS</dt>
                            <dd>{formatDecimal(ux.totals.clsAvg, 4)}</dd>
                          </div>
                          <div className="analytics-mobile-kv__row">
                            <dt>INP</dt>
                            <dd>{formatDecimal(ux.totals.inpAvg)} ms</dd>
                          </div>
                        </dl>
                      </article>
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
                    <div className="admin-mobile-list" aria-label="Web Vitals por ruta (móvil)">
                      {ux.routes.length === 0 ? (
                        <div className="admin-mobile-empty">
                          <h2>Sin datos</h2>
                          <p>Aún no hay Web Vitals registrados.</p>
                        </div>
                      ) : (
                        ux.routes.map((item) => (
                          <article key={`m_ux_route_${item.pagePath}`} className="admin-mobile-card">
                            <header className="analytics-mobile-card__head">
                              <div className="analytics-mobile-card__copy">
                                <p className="analytics-mobile-card__title">{item.pagePath}</p>
                              </div>
                            </header>
                            <dl className="analytics-mobile-kv">
                              <div className="analytics-mobile-kv__row">
                                <dt>Muestras</dt>
                                <dd>{item.samples.toLocaleString("es-MX")}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>Poor %</dt>
                                <dd>{formatPct(item.poorRatePct)}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>LCP</dt>
                                <dd>{formatDecimal(item.lcpAvg)}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>CLS</dt>
                                <dd>{formatDecimal(item.clsAvg, 4)}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>INP</dt>
                                <dd>{formatDecimal(item.inpAvg)}</dd>
                              </div>
                            </dl>
                          </article>
                        ))
                      )}
                    </div>
                    <Pagination
                      title="rutas"
                      totalData={ux.routesTotal}
                      totalLoader={loading}
                      startFilter={(_key, value) =>
                        setUxRoutesPage(typeof value === "number" ? value : Number(value))
                      }
                      currentPage={uxRoutesPage}
                      limit={uxRoutesLimit}
                    />
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
                    <div className="admin-mobile-list" aria-label="Web Vitals por dispositivo (móvil)">
                      {ux.devices.length === 0 ? (
                        <div className="admin-mobile-empty">
                          <h2>Sin datos</h2>
                          <p>Sin datos por dispositivo.</p>
                        </div>
                      ) : (
                        ux.devices.map((item) => (
                          <article key={`m_ux_device_${item.deviceCategory}`} className="admin-mobile-card">
                            <header className="analytics-mobile-card__head">
                              <div className="analytics-mobile-card__copy">
                                <p className="analytics-mobile-card__title">{item.deviceCategory}</p>
                              </div>
                            </header>
                            <dl className="analytics-mobile-kv">
                              <div className="analytics-mobile-kv__row">
                                <dt>Muestras</dt>
                                <dd>{item.samples.toLocaleString("es-MX")}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>Poor %</dt>
                                <dd>{formatPct(item.poorRatePct)}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>LCP</dt>
                                <dd>{formatDecimal(item.lcpAvg)}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>CLS</dt>
                                <dd>{formatDecimal(item.clsAvg, 4)}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>INP</dt>
                                <dd>{formatDecimal(item.inpAvg)}</dd>
                              </div>
                            </dl>
                          </article>
                        ))
                      )}
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
                    <div className="admin-mobile-list" aria-label="Top eventos (móvil)">
                      {topEvents.length === 0 ? (
                        <div className="admin-mobile-empty">
                          <h2>Sin eventos</h2>
                          <p>Sin eventos en el rango seleccionado.</p>
                        </div>
                      ) : (
                        topEvents.map((item) => (
                          <article
                            key={`m_event_${item.eventName}:${item.eventCategory}`}
                            className="admin-mobile-card"
                          >
                            <header className="analytics-mobile-card__head">
                              <div className="analytics-mobile-card__copy">
                                <p className="analytics-mobile-card__title">{item.eventName}</p>
                                <p className="analytics-mobile-card__subtitle">{item.eventCategory}</p>
                              </div>
                            </header>
                            <dl className="analytics-mobile-kv">
                              <div className="analytics-mobile-kv__row">
                                <dt>Total</dt>
                                <dd>{item.totalEvents.toLocaleString("es-MX")}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>Visitantes</dt>
                                <dd>{item.uniqueVisitors.toLocaleString("es-MX")}</dd>
                              </div>
                              <div className="analytics-mobile-kv__row">
                                <dt>Sesiones</dt>
                                <dd>{item.uniqueSessions.toLocaleString("es-MX")}</dd>
                              </div>
                            </dl>
                          </article>
                        ))
                      )}
                    </div>
                    <Pagination
                      title="eventos"
                      totalData={topEventsTotal}
                      totalLoader={loading}
                      startFilter={(_key, value) =>
                        setTopEventsPage(typeof value === "number" ? value : Number(value))
                      }
                      currentPage={topEventsPage}
                      limit={topEventsLimit}
                    />
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
