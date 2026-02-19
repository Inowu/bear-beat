import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, RefreshCw } from "src/icons";
import trpc from "../../../api";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { Spinner } from "../../../components/Spinner/Spinner";
import { SkeletonRow, Button, Input, Select } from "../../../components/ui";
import { useUserContext } from "../../../contexts/UserContext";
import "./WebhookInbox.scss";

interface WebhookInboxListItem {
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

interface WebhookInboxListResponse {
  items: WebhookInboxListItem[];
  nextCursor: number | null;
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
  provider: string;
  status: string;
  eventType: string;
  limit: number;
}

interface FetchListOptions {
  append?: boolean;
  cursor?: number | null;
}

const DEFAULT_FILTERS: WebhookInboxFilters = {
  provider: "",
  status: "",
  eventType: "",
  limit: 50,
};

const DEFAULT_PROVIDERS = ["stripe", "stripe_pi", "stripe_products", "paypal", "conekta"];
const DEFAULT_STATUSES = ["RECEIVED", "ENQUEUED", "PROCESSING", "PROCESSED", "FAILED", "IGNORED"];

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

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (!error) return fallback;
  if (error instanceof Error) {
    const trimmed = error.message.trim();
    return trimmed || fallback;
  }
  return fallback;
};

export const WebhookInbox = () => {
  const navigate = useNavigate();
  const { currentUser } = useUserContext();

  const [filters, setFilters] = useState<WebhookInboxFilters>(DEFAULT_FILTERS);
  const [items, setItems] = useState<WebhookInboxListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loader, setLoader] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<WebhookInboxDetail | null>(null);
  const [detailLoader, setDetailLoader] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [drawerItem, setDrawerItem] = useState<WebhookInboxListItem | null>(null);

  const providers = useMemo(() => {
    const values = new Set(DEFAULT_PROVIDERS);
    items.forEach((item) => values.add(item.provider));
    return Array.from(values);
  }, [items]);

  const statuses = useMemo(() => {
    const values = new Set(DEFAULT_STATUSES);
    items.forEach((item) => values.add(item.status));
    return Array.from(values);
  }, [items]);

  const drawerDetail = useMemo(() => {
    if (!drawerItem) return null;
    if (!detail) return null;
    return detail.id === drawerItem.id ? detail : null;
  }, [detail, drawerItem]);

  const fetchList = async (
    nextFilters: WebhookInboxFilters,
    options: FetchListOptions = {},
  ) => {
    const append = Boolean(options.append);
    if (!append) {
      setLoader(true);
    }

    try {
      const response = (await trpc.admin.webhookInbox.list.query({
        provider: nextFilters.provider || undefined,
        status: nextFilters.status || undefined,
        q: nextFilters.eventType || undefined,
        limit: nextFilters.limit,
        cursor: options.cursor ?? undefined,
      })) as WebhookInboxListResponse;

      const nextItems = Array.isArray(response?.items) ? response.items : [];
      const resolvedNextCursor =
        typeof response?.nextCursor === "number" ? response.nextCursor : null;

      if (append) {
        setItems((prev) => [...prev, ...nextItems]);
      } else {
        setItems(nextItems);
        if (selectedId && !nextItems.some((item) => item.id === selectedId)) {
          setSelectedId(null);
          setDetail(null);
        }
      }

      setNextCursor(resolvedNextCursor);
      setError("");
    } catch (cause) {
      if (!append) {
        setItems([]);
        setNextCursor(null);
      }
      setError(getErrorMessage(cause, "No se pudo cargar webhook inbox. Intenta nuevamente."));
    } finally {
      if (!append) {
        setLoader(false);
      }
    }
  };

  const fetchDetail = async (id: number) => {
    setDetailLoader(true);
    try {
      const response = (await trpc.admin.webhookInbox.get.query({
        id,
      })) as WebhookInboxDetail;
      setDetail(response);
      setError("");
    } catch (cause) {
      setDetail(null);
      setError(getErrorMessage(cause, "No se pudo cargar el detalle del evento."));
    } finally {
      setDetailLoader(false);
    }
  };

  const retryEvent = async (id: number) => {
    setRetryingId(id);
    try {
      await trpc.admin.webhookInbox.retry.mutate({ id });
      await fetchList(filters);
      if (selectedId === id) {
        await fetchDetail(id);
      }
      setError("");
    } catch (cause) {
      setError(getErrorMessage(cause, "No se pudo reintentar el evento."));
    } finally {
      setRetryingId(null);
    }
  };

  const startFilter = (key: keyof WebhookInboxFilters, value: string | number) => {
    const next: WebhookInboxFilters = {
      ...filters,
      [key]: value,
    } as WebhookInboxFilters;

    setFilters(next);
    void fetchList(next);
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchList(filters, {
        append: true,
        cursor: nextCursor,
      });
    } finally {
      setLoadingMore(false);
    }
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
        <Select
          value={filters.provider}
          onChange={(e) => startFilter("provider", e.target.value)}
        >
          <option value="">Todos</option>
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </Select>
      </label>

      <label className="webhook-inbox-toolbar__field">
        <span>Status</span>
        <Select
          value={filters.status}
          onChange={(e) => startFilter("status", e.target.value)}
        >
          <option value="">Todos</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </label>

      <label className="webhook-inbox-toolbar__field">
        <span>Event Type</span>
        <Input
          value={filters.eventType}
          onChange={(e) => startFilter("eventType", e.target.value)}
          placeholder="Buscar por tipo de evento…"
        />
      </label>

      <label className="webhook-inbox-toolbar__field">
        <span>Límite</span>
        <Select
          value={filters.limit}
          onChange={(e) => startFilter("limit", Number(e.target.value))}
        >
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </Select>
      </label>

      <Button unstyled
        type="button"
        className="btn-icon btn-secondary"
        onClick={() => void fetchList(filters)}
      >
        <RefreshCw size={18} aria-hidden />
        Recargar
      </Button>
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
      title={`Webhook Inbox — ${items.length}`}
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
          <table className="w-full min-w-[1040px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Received At</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Provider</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Event Type</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Status</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Attempts</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Processed At</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-5 px-4 text-sm text-center webhook-inbox-empty">
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
                  <td className="py-3 px-4 text-sm">{item.eventType}</td>
                  <td className="py-3 px-4 text-sm">
                    <span className={`webhook-inbox-status webhook-inbox-status--${item.status.toLowerCase()}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">{item.attempts}</td>
                  <td className="py-3 px-4 text-sm">{formatDateTime(item.processedAt)}</td>
                  <td className="py-3 px-4 text-sm">
                    <div className="webhook-inbox-actions">
                      <Button unstyled
                        type="button"
                        className="btn-icon btn-secondary"
                        onClick={() => setSelectedId(item.id)}
                      >
                        Ver
                      </Button>
                      {item.status === "FAILED" || item.status === "IGNORED" ? (
                        <Button unstyled
                          type="button"
                          className="btn-icon btn-secondary"
                          disabled={retryingId === item.id}
                          onClick={() => void retryEvent(item.id)}
                        >
                          {retryingId === item.id ? "Reintentando..." : "Reintentar"}
                        </Button>
                      ) : (
                        <span className="text-xs opacity-70">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {nextCursor && (
          <div className="mt-4 flex justify-center">
            <Button unstyled
              type="button"
              className="btn-icon btn-secondary"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              aria-label={loadingMore ? "Actualizando más eventos" : undefined}
            >
              {loadingMore ? <SkeletonRow width="82px" height="14px" /> : "Cargar más"}
            </Button>
          </div>
        )}
      </div>

      <div className="admin-mobile-list">
        {items.length > 0 ? (
          items.map((item) => (
            <Button unstyled
              key={`m_${item.id}`}
              className="admin-mobile-card"
              onClick={() => {
                setDrawerItem(item);
                setSelectedId(item.id);
              }}
              type="button"
            >
              <div className="admin-mobile-card__head">
                <div className="admin-mobile-card__identity">
                  <div className="admin-mobile-card__avatar">{item.provider.slice(0, 2).toUpperCase()}</div>
                  <div className="admin-mobile-card__copy">
                    <p className="admin-mobile-card__name">{item.eventType}</p>
                    <p className="admin-mobile-card__email">{item.provider} · #{item.id}</p>
                  </div>
                </div>
                <span className="admin-mobile-status is-active">{item.status}</span>
                <span className="admin-mobile-card__menu" aria-hidden>
                  <MoreVertical size={20} />
                </span>
              </div>
              <div className="admin-mobile-card__foot">
                <span>Recibido: {formatDateTime(item.receivedAt)}</span>
                <span>Intentos: {item.attempts}</span>
              </div>
            </Button>
          ))
        ) : (
          <div className="px-4 py-6 text-center">
            <p className="text-text-main text-sm font-medium">No hay eventos para los filtros seleccionados.</p>
            <p className="text-text-muted text-xs mt-1">Prueba con otro proveedor, estado o tipo de evento.</p>
          </div>
        )}
      </div>

      {nextCursor && (
        <div className="admin-pagination-mobile">
          <div className="flex justify-center">
            <Button unstyled
              type="button"
              className="btn-icon btn-secondary"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              aria-label={loadingMore ? "Actualizando más eventos" : undefined}
            >
              {loadingMore ? <SkeletonRow width="82px" height="14px" /> : "Cargar más"}
            </Button>
          </div>
        </div>
      )}

      <AdminDrawer
        open={drawerItem !== null}
        onClose={() => setDrawerItem(null)}
        title={drawerItem ? `Evento #${drawerItem.id}` : "Evento"}
        user={undefined}
        actions={
          drawerItem && (drawerItem.status === "FAILED" || drawerItem.status === "IGNORED")
            ? [
                {
                  id: `retry_${drawerItem.id}`,
                  label: retryingId === drawerItem.id ? "Reintentando..." : "Reintentar",
                  onClick: () => {
                    void retryEvent(drawerItem.id);
                  },
                  disabled: retryingId === drawerItem.id,
                  variant: "secondary",
                },
              ]
            : []
        }
      >
        {drawerItem && (
          <div className="space-y-2 text-sm">
            <p><span className="text-text-muted">Proveedor:</span> {drawerItem.provider}</p>
            <p><span className="text-text-muted">Event ID:</span> {drawerDetail?.eventId ?? drawerItem.eventId}</p>
            <p><span className="text-text-muted">Tipo:</span> {drawerItem.eventType}</p>
            <p><span className="text-text-muted">Status:</span> {drawerDetail?.status ?? drawerItem.status}</p>
            <p><span className="text-text-muted">Intentos:</span> {drawerDetail?.attempts ?? drawerItem.attempts}</p>
            <p><span className="text-text-muted">Recibido:</span> {formatDateTime(drawerItem.receivedAt)}</p>
            <p><span className="text-text-muted">Procesado:</span> {formatDateTime(drawerItem.processedAt)}</p>
            <p><span className="text-text-muted">Siguiente retry:</span> {formatDateTime(drawerDetail?.nextRetryAt ?? null)}</p>
            <p><span className="text-text-muted">Error:</span> {drawerDetail?.lastError || drawerItem.lastError || "—"}</p>
            {detailLoader && selectedId === drawerItem.id && (
              <div className="pt-2">
                <Spinner size={2} width={0.25} color="var(--app-accent)" />
              </div>
            )}
          </div>
        )}
      </AdminDrawer>

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
