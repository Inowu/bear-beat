import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, RefreshCw, Users } from "src/icons";
import trpc from "../../../api";
import { Button } from "src/components/ui";
interface CrmSourceSegmentRow {
  source: string;
  registrations: number;
  activationD1Users: number;
  activationD1Pct: number;
  paidUsers: number;
  paidPct: number;
}

interface CrmChurnRiskSummary {
  activeUsers: number;
  activeNoDownload7dUsers: number;
  activePaymentFailed14dUsers: number;
}

interface CrmChurnRiskUserRow {
  userId: number;
  username: string;
  email: string;
  phone: string | null;
  accessUntil: string;
  lastDownloadAt: string | null;
  lastPaymentFailedAt: string | null;
  riskNoDownload7d: boolean;
  riskPaymentFailed14d: boolean;
}

interface CrmSegmentationSnapshot {
  range: {
    days: number;
    start: string;
    end: string;
  };
  bySource: CrmSourceSegmentRow[];
  churnRisk: {
    summary: CrmChurnRiskSummary;
    users: CrmChurnRiskUserRow[];
  };
}

interface PaymentFailureWebhookStatus {
  provider: string;
  status: string;
  attempts: number;
  lastError: string | null;
  receivedAt: string;
  processedAt: string | null;
}

interface PaymentFailureRow {
  userId: number;
  failedAt: string;
  analyticsEventId: string;
  provider: string | null;
  providerEventId: string | null;
  reason: string | null;
  orderId: number | null;
  orderType: string | null;
  webhookStatus: PaymentFailureWebhookStatus | null;
  dunningStagesSent: number[];
}

interface FailedWebhookRow {
  id: number;
  provider: string;
  eventId: string;
  eventType: string;
  status: string;
  attempts: number;
  receivedAt: string;
  processedAt: string | null;
  lastError: string | null;
}

interface PaymentFailuresOpsSnapshot {
  range: {
    days: number;
    start: string;
    end: string;
  };
  kpis: {
    paymentFailedEvents: number;
    paymentFailedUsers: number;
    dunningEmailsSent: number;
    failedWebhooksLikelyPayment: number;
  };
  recentFailures: PaymentFailureRow[];
  recentFailedWebhooks: FailedWebhookRow[];
}

function formatDateLabel(value: string, withTime = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "0.00%";
  return `${value.toFixed(2)}%`;
}

function formatReason(reason: string | null): string {
  if (!reason) return "—";
  return reason.replace(/_/g, " ");
}

function statusTone(status: string): "ok" | "warn" | "error" {
  const normalized = status.toLowerCase();
  if (normalized.includes("processed") || normalized.includes("ok")) return "ok";
  if (normalized.includes("failed") || normalized.includes("error")) return "error";
  return "warn";
}

function CrmSkeletonBlock({ className = "" }: { className?: string }) {
  return <span className={["crm-sk", className].filter(Boolean).join(" ")} aria-hidden />;
}

function CrmTableSkeleton(props: {
  columns: number;
  rows: number;
  compact?: boolean;
  ariaLabel: string;
}) {
  const { columns, rows, compact = false, ariaLabel } = props;
  return (
    <div
      className="crm-table-wrap crm-table-wrap--skeleton mt-4"
      tabIndex={-1}
      aria-hidden
      aria-label={ariaLabel}
    >
      <table className={`crm-table${compact ? " crm-table--compact" : ""}`}>
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, idx) => (
              <th key={`th_${idx}`}>
                <CrmSkeletonBlock className="crm-sk--th" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={`row_${rowIdx}`}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={`row_${rowIdx}_col_${colIdx}`}>
                  <CrmSkeletonBlock
                    className={`crm-sk--cell ${colIdx === 0 ? "crm-sk--cell-strong" : ""}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CrmP2Panels({ rangeDays }: { rangeDays: number }) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [segmentation, setSegmentation] = useState<CrmSegmentationSnapshot | null>(null);
  const [paymentFailures, setPaymentFailures] = useState<PaymentFailuresOpsSnapshot | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [seg, failures] = await Promise.all([
        trpc.analytics.getAnalyticsCrmSegmentation.query({
          days: rangeDays,
          sourceLimit: 15,
          riskLimit: 50,
        }) as Promise<CrmSegmentationSnapshot>,
        trpc.analytics.getAnalyticsPaymentFailuresOps.query({
          days: rangeDays,
          limit: 100,
        }) as Promise<PaymentFailuresOpsSnapshot>,
      ]);
      setSegmentation(seg);
      setPaymentFailures(failures);
    } catch {
      setError("No se pudieron cargar los paneles P2 de CRM.");
      setSegmentation(null);
      setPaymentFailures(null);
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const riskSummary = useMemo(() => segmentation?.churnRisk.summary, [segmentation]);

  return (
    <>
      <section className="crm-section">
        <div className="crm-section__title-row">
          <h2 className="crm-section__title">Segmentación CRM (P2)</h2>
          <Button unstyled
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 bg-bg-card hover:bg-bg-input text-text-main font-medium rounded-pill px-4 py-2 border border-border transition-colors"
            disabled={loading}
          >
            <RefreshCw size={16} />
            {loading ? "Actualizando…" : "Actualizar"}
          </Button>
        </div>
        <p className="crm-section__hint">
          Cohortes por fuente + riesgo churn (sin descarga 7d / payment_failed 14d).
        </p>

        {error ? <p className="text-danger-400 text-sm">{error}</p> : null}

        {loading && !segmentation ? (
          <div
            className="crm-loading-panel"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Actualizando segmentación CRM"
          >
            <div className="crm-kpi-grid" role="presentation" aria-hidden>
              {Array.from({ length: 3 }).map((_, idx) => (
                <article key={`seg_kpi_${idx}`} className="crm-kpi-card crm-kpi-card--skeleton">
                  <div className="crm-kpi-card__top">
                    <CrmSkeletonBlock className="crm-sk--icon" />
                    <CrmSkeletonBlock className="crm-sk--title" />
                  </div>
                  <CrmSkeletonBlock className="crm-sk--value crm-sk--value-sm" />
                </article>
              ))}
            </div>
            <CrmTableSkeleton
              columns={6}
              rows={5}
              compact
              ariaLabel="Actualizando segmentación por fuente"
            />
            <CrmTableSkeleton
              columns={8}
              rows={6}
              ariaLabel="Actualizando usuarios en riesgo de churn"
            />
          </div>
        ) : segmentation ? (
          <>
            <div className="crm-kpi-grid" role="list" aria-label="Resumen de riesgo churn">
              <div className="crm-kpi-card" role="listitem">
                <div className="crm-kpi-card__top">
                  <span className="crm-kpi-card__icon" aria-hidden>
                    <Users />
                  </span>
                  <span className="crm-kpi-card__title">Activos</span>
                </div>
                <div className="crm-kpi-card__value">{riskSummary?.activeUsers.toLocaleString("es-MX") ?? "0"}</div>
              </div>
              <div className="crm-kpi-card" role="listitem">
                <div className="crm-kpi-card__top">
                  <span className="crm-kpi-card__icon" aria-hidden>
                    <AlertTriangle />
                  </span>
                  <span className="crm-kpi-card__title">Activos sin descarga 7d</span>
                </div>
                <div className="crm-kpi-card__value">{riskSummary?.activeNoDownload7dUsers.toLocaleString("es-MX") ?? "0"}</div>
              </div>
              <div className="crm-kpi-card" role="listitem">
                <div className="crm-kpi-card__top">
                  <span className="crm-kpi-card__icon" aria-hidden>
                    <Activity />
                  </span>
                  <span className="crm-kpi-card__title">Activos con payment_failed 14d</span>
                </div>
                <div className="crm-kpi-card__value">{riskSummary?.activePaymentFailed14dUsers.toLocaleString("es-MX") ?? "0"}</div>
              </div>
            </div>

            <div className="crm-table-wrap mt-4" tabIndex={0} aria-label="Segmentación por fuente (desplazable)">
              <table className="crm-table crm-table--compact">
                <thead>
                  <tr>
                    <th>Fuente</th>
                    <th>Registros</th>
                    <th>Activados D1</th>
                    <th>% Activación</th>
                    <th>Paid users</th>
                    <th>% Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {segmentation.bySource.map((row) => (
                    <tr key={row.source}>
                      <td>{row.source}</td>
                      <td>{row.registrations.toLocaleString("es-MX")}</td>
                      <td>{row.activationD1Users.toLocaleString("es-MX")}</td>
                      <td>{formatPct(row.activationD1Pct)}</td>
                      <td>{row.paidUsers.toLocaleString("es-MX")}</td>
                      <td>{formatPct(row.paidPct)}</td>
                    </tr>
                  ))}
                  {segmentation.bySource.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="crm-table__empty">Sin datos de fuente en el rango.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="crm-table-wrap mt-4" tabIndex={0} aria-label="Usuarios en riesgo churn (desplazable)">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Acceso hasta</th>
                    <th>Últ. descarga</th>
                    <th>Últ. payment_failed</th>
                    <th>Riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  {segmentation.churnRisk.users.map((row) => {
                    const riskLabel = [
                      row.riskNoDownload7d ? "No download 7d" : null,
                      row.riskPaymentFailed14d ? "Payment failed 14d" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <tr key={`risk_${row.userId}`}>
                        <td>{row.userId}</td>
                        <td>{row.username}</td>
                        <td>{row.email}</td>
                        <td>{row.phone ?? "—"}</td>
                        <td>{row.accessUntil}</td>
                        <td>{row.lastDownloadAt ? formatDateLabel(row.lastDownloadAt, true) : "—"}</td>
                        <td>{row.lastPaymentFailedAt ? formatDateLabel(row.lastPaymentFailedAt, true) : "—"}</td>
                        <td>{riskLabel || "—"}</td>
                      </tr>
                    );
                  })}
                  {segmentation.churnRisk.users.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="crm-table__empty">Sin usuarios en riesgo para los criterios actuales.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className="crm-section">
        <div className="crm-section__title-row">
          <h2 className="crm-section__title">Historial payment_failed (P2)</h2>
        </div>
        <p className="crm-section__hint">
          Cruce de eventos de pago fallido con estado de webhook y stages enviados de dunning.
        </p>

        {loading && !paymentFailures ? (
          <div
            className="crm-loading-panel"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Actualizando historial de payment_failed"
          >
            <div className="crm-kpi-grid" role="presentation" aria-hidden>
              {Array.from({ length: 4 }).map((_, idx) => (
                <article key={`pay_kpi_${idx}`} className="crm-kpi-card crm-kpi-card--skeleton">
                  <div className="crm-kpi-card__top">
                    <CrmSkeletonBlock className="crm-sk--icon" />
                    <CrmSkeletonBlock className="crm-sk--title" />
                  </div>
                  <CrmSkeletonBlock className="crm-sk--value crm-sk--value-sm" />
                </article>
              ))}
            </div>
            <CrmTableSkeleton
              columns={7}
              rows={6}
              ariaLabel="Actualizando eventos payment_failed"
            />
            <CrmTableSkeleton
              columns={5}
              rows={5}
              compact
              ariaLabel="Actualizando webhooks fallidos"
            />
          </div>
        ) : paymentFailures ? (
          <>
            <div className="crm-kpi-grid" role="list" aria-label="Resumen payment_failed">
              <div className="crm-kpi-card" role="listitem">
                <div className="crm-kpi-card__top">
                  <span className="crm-kpi-card__icon" aria-hidden>
                    <AlertTriangle />
                  </span>
                  <span className="crm-kpi-card__title">Eventos payment_failed</span>
                </div>
                <div className="crm-kpi-card__value">{paymentFailures.kpis.paymentFailedEvents.toLocaleString("es-MX")}</div>
              </div>
              <div className="crm-kpi-card" role="listitem">
                <div className="crm-kpi-card__top">
                  <span className="crm-kpi-card__icon" aria-hidden>
                    <Users />
                  </span>
                  <span className="crm-kpi-card__title">Usuarios afectados</span>
                </div>
                <div className="crm-kpi-card__value">{paymentFailures.kpis.paymentFailedUsers.toLocaleString("es-MX")}</div>
              </div>
              <div className="crm-kpi-card" role="listitem">
                <div className="crm-kpi-card__top">
                  <span className="crm-kpi-card__icon" aria-hidden>
                    <Activity />
                  </span>
                  <span className="crm-kpi-card__title">Dunning emails</span>
                </div>
                <div className="crm-kpi-card__value">{paymentFailures.kpis.dunningEmailsSent.toLocaleString("es-MX")}</div>
              </div>
              <div className="crm-kpi-card" role="listitem">
                <div className="crm-kpi-card__top">
                  <span className="crm-kpi-card__icon" aria-hidden>
                    <AlertTriangle />
                  </span>
                  <span className="crm-kpi-card__title">Webhooks failed (payment)</span>
                </div>
                <div className="crm-kpi-card__value">{paymentFailures.kpis.failedWebhooksLikelyPayment.toLocaleString("es-MX")}</div>
              </div>
            </div>

            <div className="crm-table-wrap mt-4" tabIndex={0} aria-label="Eventos payment_failed recientes (desplazable)">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>User ID</th>
                    <th>Provider</th>
                    <th>Razón</th>
                    <th>Order</th>
                    <th>Webhook</th>
                    <th>Dunning stages</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentFailures.recentFailures.map((row) => (
                    <tr key={row.analyticsEventId}>
                      <td>{formatDateLabel(row.failedAt, true)}</td>
                      <td>{row.userId}</td>
                      <td>{row.provider ?? "—"}</td>
                      <td>{formatReason(row.reason)}</td>
                      <td>{row.orderId ? `#${row.orderId}` : "—"}</td>
                      <td>
                        {row.webhookStatus ? (
                          <span className={`crm-status-pill crm-status-pill--${statusTone(row.webhookStatus.status)}`}>
                            {row.webhookStatus.status} ({row.webhookStatus.attempts})
                          </span>
                        ) : "—"}
                      </td>
                      <td>{row.dunningStagesSent.length ? row.dunningStagesSent.join(",") : "—"}</td>
                    </tr>
                  ))}
                  {paymentFailures.recentFailures.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="crm-table__empty">Sin eventos payment_failed en el rango.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="crm-table-wrap mt-4" tabIndex={0} aria-label="Webhooks fallidos de pago (desplazable)">
              <table className="crm-table crm-table--compact">
                <thead>
                  <tr>
                    <th>Recibido</th>
                    <th>Provider</th>
                    <th>Tipo</th>
                    <th>Intentos</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentFailures.recentFailedWebhooks.map((row) => (
                    <tr key={`wh_${row.id}`}>
                      <td>{formatDateLabel(row.receivedAt, true)}</td>
                      <td>{row.provider}</td>
                      <td>{row.eventType}</td>
                      <td>{row.attempts}</td>
                      <td>{row.lastError || "—"}</td>
                    </tr>
                  ))}
                  {paymentFailures.recentFailedWebhooks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="crm-table__empty">Sin webhooks fallidos de pago en el rango.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}
