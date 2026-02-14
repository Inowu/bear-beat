import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clock,
  CreditCard,
  Database,
  RefreshCw,
  TrendingUp,
  Users,
} from "src/icons";
import trpc from "../../../api";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import Pagination from "../../../components/Pagination/Pagination";
import { Spinner } from "../../../components/Spinner/Spinner";
import "../Analytics/AnalyticsDashboard.scss";
import "./LiveAnalytics.scss";

interface LiveEventPoint {
  ts: string;
  name: string;
  pagePath: string | null;
  visitorId: string | null;
  sessionId: string | null;
  userId: number | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
}

interface LiveSnapshot {
  window: {
    minutes: number;
    start: string;
    end: string;
  };
  activeVisitors: number;
  activeSessions: number;
  activeCheckouts: number;
  eventsTotal: number;
  events: LiveEventPoint[];
}

const MINUTES_OPTIONS = [5, 10, 15, 30, 60];

function formatTs(value: string): string {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("es-MX");
  } catch {
    return value;
  }
}

function formatTime(value: string): string {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString("es-MX");
  } catch {
    return value;
  }
}

function formatCompactId(value: string | null | undefined, slice = 6): string {
  if (!value) return "—";
  if (value.length <= slice * 2 + 1) return value;
  return `${value.slice(0, slice)}…${value.slice(-slice)}`;
}

function rate(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function eventTone(
  eventName: string,
): "positive" | "warning" | "danger" | "neutral" {
  const name = eventName.toLowerCase();
  if (name.includes("payment_success") || name.includes("trial_converted") || name.includes("subscription_renewed")) {
    return "positive";
  }
  if (name.includes("cancel") || name.includes("error") || name.includes("failed")) {
    return "danger";
  }
  if (name.includes("checkout") || name.includes("trial_started")) {
    return "warning";
  }
  return "neutral";
}

function formatUtm(evt: LiveEventPoint): string {
  if (!(evt.source || evt.medium || evt.campaign)) return "—";
  return `${evt.source ?? "—"} / ${evt.campaign ?? "—"} / ${evt.medium ?? "—"}`;
}

export function LiveAnalytics() {
  const [minutes, setMinutes] = useState<number>(10);
  const [limit, setLimit] = useState<number>(100);
  const [page, setPage] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [filterEvent, setFilterEvent] = useState<string>("");
  const [filterPath, setFilterPath] = useState<string>("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>("");

  const fetchLive = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await trpc.analytics.getAnalyticsLiveSnapshot.query({
        minutes,
        limit,
        page,
      });
      setSnapshot(data as LiveSnapshot);
      setLastUpdatedAt(new Date().toISOString());
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "No fue posible cargar la vista Live.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [minutes, limit, page]);

  useEffect(() => {
    void fetchLive();
  }, [fetchLive]);

  useEffect(() => {
    const id = window.setInterval(() => {
      // Only auto-refresh when looking at the first page (latest events).
      if (paused || page > 0) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void fetchLive();
    }, 4000);
    return () => window.clearInterval(id);
  }, [fetchLive, paused, page]);

  const filteredEvents = useMemo(() => {
    if (!snapshot) return [];
    const eventNeedle = filterEvent.trim().toLowerCase();
    const pathNeedle = filterPath.trim().toLowerCase();

    return snapshot.events.filter((evt) => {
      if (eventNeedle && !evt.name.toLowerCase().includes(eventNeedle)) return false;
      if (pathNeedle && !(evt.pagePath || "").toLowerCase().includes(pathNeedle)) return false;
      return true;
    });
  }, [snapshot, filterEvent, filterPath]);

  const liveSummary = useMemo(() => {
    if (!snapshot) {
      return {
        eventsPerMinute: 0,
        checkoutPressurePct: 0,
        identifiedRatePct: 0,
        topEvents: [] as Array<{ name: string; count: number }>,
        topPaths: [] as Array<{ path: string; count: number }>,
      };
    }

    const eventsPerMinute = snapshot.window.minutes > 0
      ? (snapshot.eventsTotal || snapshot.events.length) / snapshot.window.minutes
      : 0;
    const checkoutPressurePct = rate(snapshot.activeCheckouts, snapshot.activeSessions);
    const identifiedEvents = snapshot.events.filter((evt) => evt.userId !== null).length;
    const identifiedRatePct = rate(identifiedEvents, snapshot.events.length);

    const eventMap = new Map<string, number>();
    const pathMap = new Map<string, number>();

    snapshot.events.forEach((evt) => {
      eventMap.set(evt.name, (eventMap.get(evt.name) ?? 0) + 1);
      const pathKey = evt.pagePath ?? "sin_ruta";
      pathMap.set(pathKey, (pathMap.get(pathKey) ?? 0) + 1);
    });

    const topEvents = Array.from(eventMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));

    const topPaths = Array.from(pathMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([path, count]) => ({ path, count }));

    return {
      eventsPerMinute,
      checkoutPressurePct,
      identifiedRatePct,
      topEvents,
      topPaths,
    };
  }, [snapshot]);

  const activeFilterCount = useMemo(() => {
    let total = 0;
    if (filterEvent.trim()) total += 1;
    if (filterPath.trim()) total += 1;
    return total;
  }, [filterEvent, filterPath]);

  const rangeLabel = useMemo(() => {
    if (!snapshot) return "—";
    return `${formatTs(snapshot.window.start)} → ${formatTs(snapshot.window.end)}`;
  }, [snapshot]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) return "—";
    return formatTs(lastUpdatedAt);
  }, [lastUpdatedAt]);

  const toolbar = (
    <div className="live-toolbar">
      <div className="live-toolbar__group live-toolbar__group--core">
        <label className="live-toolbar__field">
          Ventana
          <select
            value={minutes}
            onChange={(e) => {
              setMinutes(Number(e.target.value));
              setPage(0);
            }}
          >
            {MINUTES_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value} min
              </option>
            ))}
          </select>
        </label>
        <label className="live-toolbar__field">
          Límite
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(0);
            }}
          >
            {[100, 200, 500].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="live-toolbar__group live-toolbar__group--filters">
        <label className="live-toolbar__field">
          Filtro evento
          <input
            type="text"
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            placeholder="payment_success"
          />
        </label>
        <label className="live-toolbar__field">
          Filtro ruta
          <input
            type="text"
            value={filterPath}
            onChange={(e) => setFilterPath(e.target.value)}
            placeholder="/comprar"
          />
        </label>
      </div>
      <div className="live-toolbar__group live-toolbar__group--actions">
        <span
          className={`live-toolbar__status ${
            paused ? "live-toolbar__status--paused" : "live-toolbar__status--live"
          }`}
          role="status"
        >
          {paused ? "En pausa" : "En vivo"}
        </span>
        <button
          type="button"
          onClick={() => {
            // Reanudar siempre vuelve a la primera página (modo "live").
            setPaused((prev) => {
              const next = !prev;
              if (!next) setPage(0);
              return next;
            });
          }}
          className="live-toolbar__btn"
        >
          {paused ? "Reanudar" : "Pausar"}
        </button>
        <button
          type="button"
          onClick={() => void fetchLive()}
          disabled={loading}
          className="live-toolbar__btn live-toolbar__btn--primary"
        >
          <RefreshCw size={16} className={loading ? "is-spinning" : ""} />
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>
    </div>
  );

  return (
    <AdminPageLayout
      title="Live (tiempo real)"
      subtitle="Supervisa actividad en vivo y detecta cuellos de conversión al momento."
      toolbar={toolbar}
    >
      <section className="analytics-dashboard live-dashboard">
        {error && (
          <div className="analytics-alert analytics-alert--error" role="alert">
            {error}
          </div>
        )}

        {!snapshot && loading ? (
          <div className="analytics-loading">
            <Spinner size={3} width={0.3} color="var(--app-accent)" />
            <p>Cargando vista Live...</p>
          </div>
        ) : (
          <>
            {snapshot && (
              <>
                <section className="live-context" aria-label="Contexto de la ventana Live">
                  <div className="live-context__head">
                    <p className="live-context__range">{rangeLabel}</p>
                    <p className="live-context__updated">
                      Última actualización: <strong>{lastUpdatedLabel}</strong>
                    </p>
                  </div>
                  <div className="live-context__chips">
                    <span className="live-chip">
                      <Database size={14} aria-hidden />
                      Fuente: analytics_events
                    </span>
                    <span className="live-chip">
                      <Clock size={14} aria-hidden />
                      Auto refresh: 4s ({paused ? "pausado" : "activo"})
                    </span>
                    <span className="live-chip">
                      <TrendingUp size={14} aria-hidden />
                      Filtros activos: {activeFilterCount}
                    </span>
                  </div>
                </section>

                <div className="analytics-kpi-grid live-kpi-grid">
                  <article className="analytics-kpi-card live-kpi-card">
                    <header>
                      <span>Visitantes activos</span>
                      <Users size={16} />
                    </header>
                    <strong>{snapshot.activeVisitors.toLocaleString("es-MX")}</strong>
                    <small>Ventana: {snapshot.window.minutes} min</small>
                  </article>
                  <article className="analytics-kpi-card live-kpi-card">
                    <header>
                      <span>Sesiones activas</span>
                      <Activity size={16} />
                    </header>
                    <strong>{snapshot.activeSessions.toLocaleString("es-MX")}</strong>
                    <small>En la ventana actual</small>
                  </article>
                  <article className="analytics-kpi-card live-kpi-card">
                    <header>
                      <span>Checkouts activos</span>
                      <CreditCard size={16} />
                    </header>
                    <strong>{snapshot.activeCheckouts.toLocaleString("es-MX")}</strong>
                    <small>Sin pago en ventana</small>
                  </article>
                  <article className="analytics-kpi-card live-kpi-card">
                    <header>
                      <span>Eventos capturados</span>
                      <Activity size={16} />
                    </header>
                    <strong>{snapshot.eventsTotal.toLocaleString("es-MX")}</strong>
                    <small>
                      Página {page + 1} · {snapshot.events.length.toLocaleString("es-MX")} mostrados
                    </small>
                  </article>
                  <article className="analytics-kpi-card live-kpi-card">
                    <header>
                      <span>Ritmo de eventos</span>
                      <TrendingUp size={16} />
                    </header>
                    <strong>{liveSummary.eventsPerMinute.toFixed(1)}/min</strong>
                    <small>Eventos / minutos</small>
                  </article>
                  <article className="analytics-kpi-card live-kpi-card">
                    <header>
                      <span>Presión checkout</span>
                      <CreditCard size={16} />
                    </header>
                    <strong>{formatPct(liveSummary.checkoutPressurePct)}</strong>
                    <small>Checkouts activos / sesiones</small>
                  </article>
                </div>

                <section className="live-insights">
                  <article className="live-insights__panel">
                    <h2>Eventos más frecuentes</h2>
                    <p>Ayuda a ver qué acciones dominan el tráfico de la ventana.</p>
                    <div className="live-insights__chips">
                      {liveSummary.topEvents.length === 0 ? (
                        <span className="live-chip live-chip--muted">Sin eventos</span>
                      ) : (
                        liveSummary.topEvents.map((item) => (
                          <span key={item.name} className={`live-event-pill live-event-pill--${eventTone(item.name)}`}>
                            {item.name}
                            <em>{item.count}</em>
                          </span>
                        ))
                      )}
                    </div>
                  </article>
                  <article className="live-insights__panel">
                    <h2>Rutas más activas</h2>
                    <p>Sirve para detectar en qué parte del flujo se concentra la actividad.</p>
                    <div className="live-insights__chips">
                      {liveSummary.topPaths.length === 0 ? (
                        <span className="live-chip live-chip--muted">Sin rutas</span>
                      ) : (
                        liveSummary.topPaths.map((item) => (
                          <span key={item.path} className="live-chip">
                            {item.path === "sin_ruta" ? "Sin ruta" : item.path}
                            <em>{item.count}</em>
                          </span>
                        ))
                      )}
                    </div>
                  </article>
                </section>

                <section className="analytics-panel live-stream">
                  <div className="live-stream__head">
                    <div>
                      <h2>Stream de eventos</h2>
                      <p>
                        Mostrando {filteredEvents.length.toLocaleString("es-MX")} de{" "}
                        {snapshot.events.length.toLocaleString("es-MX")} eventos (total{" "}
                        {snapshot.eventsTotal.toLocaleString("es-MX")}).
                      </p>
                    </div>
                    <div className="live-stream__meta">
                      {filterEvent.trim() && (
                        <span className="live-filter-pill">
                          Evento: {filterEvent.trim()}
                        </span>
                      )}
                      {filterPath.trim() && (
                        <span className="live-filter-pill">
                          Ruta: {filterPath.trim()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="analytics-table-wrap"
                    tabIndex={0}
                    aria-label="Tabla de eventos (desplazable)"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Hora</th>
                          <th>Evento</th>
                          <th>Ruta</th>
                          <th>Usuario</th>
                          <th>Session</th>
                          <th>Visitor</th>
                          <th>UTM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEvents.length === 0 ? (
                          <tr>
                            <td colSpan={7}>No hay eventos para los filtros actuales.</td>
                          </tr>
                        ) : (
                          filteredEvents.map((evt, index) => (
                            <tr key={`${evt.ts}:${evt.sessionId}:${evt.visitorId}:${evt.name}:${index}`}>
                              <td>
                                <span className="live-time" title={formatTs(evt.ts)}>
                                  {formatTime(evt.ts)}
                                </span>
                              </td>
                              <td>
                                <span className={`live-event-pill live-event-pill--${eventTone(evt.name)}`}>
                                  {evt.name}
                                </span>
                              </td>
                              <td>
                                <span className="live-path" title={evt.pagePath ?? "Sin ruta"}>
                                  {evt.pagePath ?? "—"}
                                </span>
                              </td>
                              <td>
                                {evt.userId ? (
                                  `#${evt.userId}`
                                ) : (
                                  <span className="live-user-pill">Anónimo</span>
                                )}
                              </td>
                              <td title={evt.sessionId ?? "Sin session"}>
                                {formatCompactId(evt.sessionId)}
                              </td>
                              <td title={evt.visitorId ?? "Sin visitor"}>
                                {formatCompactId(evt.visitorId)}
                              </td>
                              <td title={formatUtm(evt)}>
                                <span className="live-utm">{formatUtm(evt)}</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="admin-mobile-list live-mobile-list" aria-label="Eventos (móvil)">
                    {filteredEvents.length === 0 ? (
                      <div className="admin-mobile-empty">
                        <h2>Sin eventos</h2>
                        <p>No hay eventos para los filtros actuales.</p>
                      </div>
                    ) : (
                      filteredEvents.map((evt, index) => (
                        <article
                          key={`m_${evt.ts}:${evt.sessionId}:${evt.visitorId}:${evt.name}:${index}`}
                          className="admin-mobile-card live-mobile-card"
                        >
                          <header className="live-mobile-card__head">
                            <span className="live-time" title={formatTs(evt.ts)}>
                              {formatTime(evt.ts)}
                            </span>
                            <span className={`live-event-pill live-event-pill--${eventTone(evt.name)}`}>
                              {evt.name}
                            </span>
                          </header>
                          <p className="live-mobile-card__path" title={evt.pagePath ?? "Sin ruta"}>
                            {evt.pagePath ?? "—"}
                          </p>
                          <dl className="live-mobile-kv">
                            <div className="live-mobile-kv__row">
                              <dt>Usuario</dt>
                              <dd>{evt.userId ? `#${evt.userId}` : "Anónimo"}</dd>
                            </div>
                            <div className="live-mobile-kv__row">
                              <dt>Session</dt>
                              <dd title={evt.sessionId ?? "Sin session"}>{formatCompactId(evt.sessionId)}</dd>
                            </div>
                            <div className="live-mobile-kv__row">
                              <dt>Visitor</dt>
                              <dd title={evt.visitorId ?? "Sin visitor"}>{formatCompactId(evt.visitorId)}</dd>
                            </div>
                          </dl>
                          <div className="live-mobile-card__utm" title={formatUtm(evt)}>
                            <span className="live-mobile-card__utm-label">UTM</span>
                            <span className="live-utm">{formatUtm(evt)}</span>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                  <Pagination
                    title="eventos"
                    totalData={snapshot.eventsTotal}
                    totalLoader={loading}
                    startFilter={(_key, value) => {
                      const nextPage = typeof value === "number" ? value : Number(value);
                      if (!Number.isFinite(nextPage)) return;
                      setPage(nextPage);
                      if (nextPage > 0) setPaused(true);
                    }}
                    currentPage={page}
                    limit={limit}
                  />
                  <div className="analytics-foot live-foot">
                    <p>
                      Lectura rápida: identificación por usuario en stream{" "}
                      <strong>{formatPct(liveSummary.identifiedRatePct)}</strong>.
                    </p>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </section>
    </AdminPageLayout>
  );
}
