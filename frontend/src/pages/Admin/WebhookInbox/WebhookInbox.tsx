import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "src/icons";
import trpc from "../../../api";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import Pagination from "../../../components/Pagination/Pagination";
import { Spinner } from "../../../components/Spinner/Spinner";
import { useUserContext } from "../../../contexts/UserContext";
import "./WebhookInbox.scss";

interface WebhookInboxListItem {
  id: number;
  provider: string;
  eventId: string;
  eventType: string;
  livemode: boolean | null;
  status: string;
  attempts: number;
  receivedAt: string;
  processedAt: string | null;
  nextRetryAt: string | null;
  lastError: string | null;
}

interface WebhookInboxListResponse {
  page: number;
  limit: number;
  total: number;
  items: WebhookInboxListItem[];
}

interface WebhookInboxDetail {
  id: number;
  provider: string;
  eventId: string;
  eventType: string;
  livemode: boolean | null;
  status: string;
  attempts: number;
  receivedAt: string;
  updatedAt: string;
  processedAt: string | null;
  nextRetryAt: string | null;
  processingStartedAt: string | null;
  payloadHash: string | null;
  headers: unknown;
  payloadRaw: string;
  lastError: string | null;
}

interface WebhookInboxFilters {
  page: number;
  limit: number;
  provider: string;
  status: string;
  eventType: string;
  eventId: string;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: WebhookInboxFilters = {
  page: 0,
  limit: 100,
  provider: "",
  status: "",
  eventType: "",
  eventId: "",
  dateFrom: "",
  dateTo: "",
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const formatJson = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "—";
  }
};

export const WebhookInbox = () => {
  const navigate = useNavigate();
  const { currentUser } = useUserContext();

  const [filters, setFilters] = useState<WebhookInboxFilters>(DEFAULT_FILTERS);
  const [items, setItems] = useState<WebhookInboxListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loader, setLoader] = useState(true);
  const [totalLoader, setTotalLoader] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<WebhookInboxDetail | null>(null);
  const [detailLoader, setDetailLoader] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const providers = useMemo(() => {
    const values = new Set(["stripe", "stripe_pi", "stripe_products", "paypal", "conekta"]);
    items.forEach((item) => values.add(item.provider));
    return Array.from(values);
  }, [items]);

  const statuses = useMemo(() => {
    const values = new Set(["RECEIVED", "ENQUEUED", "PROCESSING", "PROCESSED", "FAILED", "IGNORED"]);
    items.forEach((item) => values.add(item.status));
    return Array.from(values);
  }, [items]);

  const fetchList = async (next: WebhookInboxFilters) => {
    setLoader(true);
    setTotalLoader(true);

    try {
      const response = (await trpc.webhookInbox.listWebhookInboxEvents.query({
        page: next.page,
        limit: next.limit,
        provider: next.provider || undefined,
        status: next.status || undefined,
        eventType: next.eventType || undefined,
        eventId: next.eventId || undefined,
        dateFrom: next.dateFrom || undefined,
        dateTo: next.dateTo || undefined,
      })) as WebhookInboxListResponse;

      const nextItems = Array.isArray(response?.items) ? response.items : [];
      setItems(nextItems);
      setTotal(response?.total ?? 0);
      setError("");

      if (selectedId && !nextItems.some((item) => item.id === selectedId)) {
        setSelectedId(null);
        setDetail(null);
      }
    } catch {
      setItems([]);
      setTotal(0);
      setError("No se pudo cargar webhook inbox. Intenta nuevamente.");
    } finally {
      setLoader(false);
      setTotalLoader(false);
    }
  };

  const fetchDetail = async (id: number) => {
    setDetailLoader(true);
    try {
      const response = (await trpc.webhookInbox.getWebhookInboxEvent.query({
        id,
      })) as WebhookInboxDetail;
      setDetail(response);
    } catch {
      setDetail(null);
      setError("No se pudo cargar el detalle del evento.");
    } finally {
      setDetailLoader(false);
    }
  };

  const retryEvent = async (id: number) => {
    setRetryingId(id);
    try {
      await trpc.webhookInbox.retryWebhookInboxEvent.mutate({ id });
      await fetchList(filters);
      if (selectedId === id) {
        await fetchDetail(id);
      }
      setError("");
    } catch {
      setError("No se pudo reintentar el evento.");
    } finally {
      setRetryingId(null);
    }
  };

  const startFilter = (key: keyof WebhookInboxFilters, value: string | number) => {
    const next: WebhookInboxFilters = {
      ...filters,
      [key]: String(value),
    } as WebhookInboxFilters;

    if (key === "page") {
      next.page = Number(value);
    } else {
      next.page = 0;
    }

    if (key === "limit") {
      next.limit = Number(value);
    }

    setFilters(next);
    void fetchList(next);
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") navigate("/");
  }, [currentUser, navigate]);

  useEffect(() => {
    void fetchList(DEFAULT_FILTERS);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void fetchDetail(selectedId);
  }, [selectedId]);

  const toolbar = (
    <div className="webhook-inbox-toolbar">
      <label className="webhook-inbox-toolbar__field">
        <span>Proveedor</span>
        <select
          value={filters.provider}
          onChange={(e) => startFilter("provider", e.target.value)}
        >
          <option value="">Todos</option>
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      </label>

      <label className="webhook-inbox-toolbar__field">
        <span>Status</span>
        <select
          value={filters.status}
          onChange={(e) => startFilter("status", e.target.value)}
        >
          <option value="">Todos</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      <label className="webhook-inbox-toolbar__field">
        <span>Tipo de evento</span>
        <input
          value={filters.eventType}
          onChange={(e) => startFilter("eventType", e.target.value)}
          placeholder="customer.subscription.updated"
        />
      </label>

      <label className="webhook-inbox-toolbar__field">
        <span>Event ID</span>
        <input
          value={filters.eventId}
          onChange={(e) => startFilter("eventId", e.target.value)}
          placeholder="evt_..."
        />
      </label>

      <label className="webhook-inbox-toolbar__field">
        <span>Desde</span>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => startFilter("dateFrom", e.target.value)}
        />
      </label>

      <label className="webhook-inbox-toolbar__field">
        <span>Hasta</span>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => startFilter("dateTo", e.target.value)}
        />
      </label>

      <label className="webhook-inbox-toolbar__field">
        <span>Por página</span>
        <select
          value={filters.limit}
          onChange={(e) => startFilter("limit", Number(e.target.value))}
        >
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
      </label>

      <button
        type="button"
        className="btn-icon btn-secondary"
        onClick={() => void fetchList(filters)}
      >
        <RefreshCw size={18} aria-hidden />
        Recargar
      </button>
    </div>
  );

  if (loader && items.length === 0) {
    return (
      <AdminPageLayout
        title="Webhook Inbox"
        subtitle="Recepción durable con dedupe, retries y trazabilidad por evento."
      >
        <div className="flex justify-center py-12">
          <Spinner size={3} width={0.3} color="var(--app-accent)" />
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title={`Webhook Inbox — ${total}`}
      subtitle="Inspecciona eventos recibidos, estado de procesamiento y reintenta manualmente cuando aplique."
      toolbar={toolbar}
    >
      {error && (
        <div className="admin-error-strip">
          <p>{error}</p>
        </div>
      )}

      <div className="admin-table-panel">
        <div
          className="overflow-x-auto max-h-[56vh] overflow-y-auto"
          tabIndex={0}
          role="region"
          aria-label="Tabla de webhook inbox"
          data-scroll-region
        >
          <table className="w-full min-w-[1240px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Fecha</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Proveedor</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Evento</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Tipo</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Status</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Intentos</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Siguiente retry</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-5 px-4 text-sm text-center webhook-inbox-empty">
                    No hay eventos para los filtros seleccionados.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b transition-colors ${selectedId === item.id ? "webhook-inbox-row--selected" : ""}`}
                >
                  <td className="py-3 px-4 text-sm whitespace-nowrap">{formatDateTime(item.receivedAt)}</td>
                  <td className="py-3 px-4 text-sm">{item.provider}</td>
                  <td className="py-3 px-4 text-sm">
                    <span className="webhook-inbox-event-id" title={item.eventId}>
                      {item.eventId}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">{item.eventType}</td>
                  <td className="py-3 px-4 text-sm">
                    <span className={`webhook-inbox-status webhook-inbox-status--${item.status.toLowerCase()}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">{item.attempts}</td>
                  <td className="py-3 px-4 text-sm">{formatDateTime(item.nextRetryAt)}</td>
                  <td className="py-3 px-4 text-sm">
                    <div className="webhook-inbox-actions">
                      <button
                        type="button"
                        className="btn-icon btn-secondary"
                        onClick={() => setSelectedId(item.id)}
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        className="btn-icon btn-secondary"
                        disabled={retryingId === item.id}
                        onClick={() => void retryEvent(item.id)}
                      >
                        {retryingId === item.id ? "Reintentando..." : "Reintentar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={8} className="py-3 px-4">
                  <Pagination
                    totalData={total}
                    title="eventos"
                    startFilter={startFilter}
                    currentPage={filters.page}
                    limit={filters.limit}
                    totalLoader={totalLoader}
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {selectedId && (
        <div className="webhook-inbox-detail">
          <h2>Detalle del evento #{selectedId}</h2>
          {detailLoader && (
            <div className="webhook-inbox-detail__loader">
              <Spinner size={2} width={0.25} color="var(--app-accent)" />
            </div>
          )}
          {!detailLoader && detail && (
            <div className="webhook-inbox-detail__content">
              <div className="webhook-inbox-detail__grid">
                <p><strong>Provider:</strong> {detail.provider}</p>
                <p><strong>Event ID:</strong> {detail.eventId}</p>
                <p><strong>Event Type:</strong> {detail.eventType}</p>
                <p><strong>Status:</strong> {detail.status}</p>
                <p><strong>Intentos:</strong> {detail.attempts}</p>
                <p><strong>Recibido:</strong> {formatDateTime(detail.receivedAt)}</p>
                <p><strong>Procesado:</strong> {formatDateTime(detail.processedAt)}</p>
                <p><strong>Siguiente retry:</strong> {formatDateTime(detail.nextRetryAt)}</p>
                <p><strong>Hash:</strong> {detail.payloadHash || "—"}</p>
                <p><strong>Error:</strong> {detail.lastError || "—"}</p>
              </div>

              <div className="webhook-inbox-detail__panels">
                <section>
                  <h3>Headers</h3>
                  <pre>{formatJson(detail.headers)}</pre>
                </section>
                <section>
                  <h3>Payload raw</h3>
                  <pre>{detail.payloadRaw || "—"}</pre>
                </section>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminPageLayout>
  );
};
