import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CreditCard, RefreshCw, Users } from "lucide-react";
import trpc from "../../../api";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
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

export function LiveAnalytics() {
  const [minutes, setMinutes] = useState<number>(10);
  const [limit, setLimit] = useState<number>(200);
  const [paused, setPaused] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [filterEvent, setFilterEvent] = useState<string>("");
  const [filterPath, setFilterPath] = useState<string>("");

  const fetchLive = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await trpc.analytics.getAnalyticsLiveSnapshot.query({
        minutes,
        limit,
      });
      setSnapshot(data as LiveSnapshot);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "No fue posible cargar la vista Live.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [minutes, limit]);

  useEffect(() => {
    void fetchLive();
  }, [fetchLive]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (paused) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void fetchLive();
    }, 4000);
    return () => window.clearInterval(id);
  }, [fetchLive, paused]);

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

  const toolbar = (
    <div className="live-toolbar">
      <label className="live-toolbar__field">
        Ventana
        <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {MINUTES_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value} min
            </option>
          ))}
        </select>
      </label>
      <label className="live-toolbar__field">
        Límite
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          {[50, 100, 200, 300, 500].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
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
      <button
        type="button"
        onClick={() => setPaused((prev) => !prev)}
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
  );

  return (
    <AdminPageLayout title="Live (tiempo real)" toolbar={toolbar}>
      <section className="analytics-dashboard">
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
                <div className="analytics-kpi-grid">
                  <article className="analytics-kpi-card">
                    <header>
                      <span>Visitantes activos</span>
                      <Users size={16} />
                    </header>
                    <strong>{snapshot.activeVisitors.toLocaleString("es-MX")}</strong>
                    <small>Ventana: {snapshot.window.minutes} min</small>
                  </article>
                  <article className="analytics-kpi-card">
                    <header>
                      <span>Sesiones activas</span>
                      <Activity size={16} />
                    </header>
                    <strong>{snapshot.activeSessions.toLocaleString("es-MX")}</strong>
                    <small>Desde {formatTs(snapshot.window.start)}</small>
                  </article>
                  <article className="analytics-kpi-card">
                    <header>
                      <span>Checkouts activos</span>
                      <CreditCard size={16} />
                    </header>
                    <strong>{snapshot.activeCheckouts.toLocaleString("es-MX")}</strong>
                    <small>Sin pago en ventana</small>
                  </article>
                </div>

                <section className="analytics-panel">
                  <h2>Stream de eventos</h2>
                  <p>
                    Última actualización: {formatTs(snapshot.window.end)} · Mostrando{" "}
                    {filteredEvents.length.toLocaleString("es-MX")} /{" "}
                    {snapshot.events.length.toLocaleString("es-MX")}
                  </p>
                  <div
                    className="analytics-table-wrap"
                    tabIndex={0}
                    aria-label="Tabla de eventos (desplazable)"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>TS</th>
                          <th>Evento</th>
                          <th>Ruta</th>
                          <th>Visitor</th>
                          <th>Session</th>
                          <th>User</th>
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
                              <td>{formatTs(evt.ts)}</td>
                              <td>{evt.name}</td>
                              <td>{evt.pagePath ?? "—"}</td>
                              <td>{evt.visitorId ?? "—"}</td>
                              <td>{evt.sessionId ?? "—"}</td>
                              <td>{evt.userId ?? "—"}</td>
                              <td>
                                {(evt.source || evt.medium || evt.campaign) ? (
                                  <span>
                                    {evt.source ?? "—"} / {evt.campaign ?? "—"} / {evt.medium ?? "—"}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
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
