import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, RefreshCw } from "src/icons";
import trpc from "../../../api";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import Pagination from "../../../components/Pagination/Pagination";
import { Spinner } from "../../../components/Spinner/Spinner";
import { useUserContext } from "../../../contexts/UserContext";
import "./AuditLogs.scss";
import { Button, Input, Select } from "../../../components/ui";

interface AdminAuditLogItem {
  id: number;
  createdAt: string;
  actorUserId: number;
  action: string;
  targetUserId: number | null;
  metadata: unknown;
  ip: string | null;
  userAgent: string | null;
}

interface AdminAuditLogsResponse {
  page: number;
  limit: number;
  total: number;
  items: AdminAuditLogItem[];
}

interface AuditLogFilters {
  page: number;
  limit: number;
  action: string;
  targetUserId: string;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: AuditLogFilters = {
  page: 0,
  limit: 50,
  action: "",
  targetUserId: "",
  dateFrom: "",
  dateTo: "",
};

const KNOWN_ACTIONS = [
  "impersonate_user",
  "block_user",
  "unblock_user",
  "create_order",
  "update_order",
  "delete_order",
  "cancel_order",
  "upsert_ad_spend_monthly",
  "delete_ad_spend_monthly",
  "create_coupon",
  "update_coupon",
  "delete_coupon",
  "create_plan_stripe",
  "update_plan_stripe",
  "delete_plan_stripe",
  "create_plan_paypal",
  "deactivate_plan_paypal",
  "activate_plan_for_user",
];

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const formatMetadata = (metadata: unknown): string => {
  if (!metadata) return "—";
  try {
    const text = JSON.stringify(metadata);
    return text.length > 160 ? `${text.slice(0, 160)}…` : text;
  } catch {
    return "—";
  }
};

export const AuditLogs = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminAuditLogItem[]>([]);
  const [filters, setFilters] = useState<AuditLogFilters>(DEFAULT_FILTERS);
  const [total, setTotal] = useState(0);
  const [loader, setLoader] = useState(true);
  const [totalLoader, setTotalLoader] = useState(false);
  const [error, setError] = useState("");
  const [drawerItem, setDrawerItem] = useState<AdminAuditLogItem | null>(null);

  const actionOptions = useMemo(() => {
    const fromRows = items.map((item) => item.action);
    return Array.from(new Set([...KNOWN_ACTIONS, ...fromRows])).sort();
  }, [items]);

  const fetchAuditLogs = async (next: AuditLogFilters) => {
    const targetUserIdRaw = next.targetUserId.trim();
    const targetUserId = targetUserIdRaw ? Number(targetUserIdRaw) : undefined;
    if (
      targetUserIdRaw &&
      (!Number.isFinite(targetUserId) || targetUserId == null || targetUserId <= 0)
    ) {
      setError("El filtro de usuario objetivo debe ser un número positivo.");
      setItems([]);
      setTotal(0);
      setLoader(false);
      setTotalLoader(false);
      return;
    }

    setLoader(true);
    setTotalLoader(true);
    try {
      const response = (await trpc.adminAuditLogs.getAdminAuditLogs.query({
        page: next.page,
        limit: next.limit,
        action: next.action || undefined,
        targetUserId: targetUserIdRaw ? targetUserId : undefined,
        dateFrom: next.dateFrom || undefined,
        dateTo: next.dateTo || undefined,
      })) as AdminAuditLogsResponse;

      setItems(Array.isArray(response?.items) ? response.items : []);
      setTotal(response?.total ?? 0);
      setError("");
    } catch {
      setItems([]);
      setTotal(0);
      setError("No se pudieron cargar los logs de auditoría. Intenta nuevamente.");
    } finally {
      setLoader(false);
      setTotalLoader(false);
    }
  };

  const startFilter = (key: string, value: string | number) => {
    const next: AuditLogFilters = {
      ...filters,
      [key]: String(value),
    } as AuditLogFilters;
    if (key === "page") {
      next.page = Number(value);
    } else {
      next.page = 0;
    }
    if (key === "limit") {
      next.limit = Number(value);
    }
    setFilters(next);
    void fetchAuditLogs(next);
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") navigate("/");
  }, [currentUser, navigate]);

  useEffect(() => {
    void fetchAuditLogs(DEFAULT_FILTERS);
  }, []);

  const toolbar = (
    <div className="audit-logs-toolbar">
      <label className="audit-logs-toolbar__field">
        <span>Acción</span>
        <Select
          value={filters.action}
          onChange={(e) => startFilter("action", e.target.value)}
        >
          <option value="">Todas</option>
          {actionOptions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </Select>
      </label>
      <label className="audit-logs-toolbar__field">
        <span>Usuario objetivo</span>
        <Input
          value={filters.targetUserId}
          onChange={(e) => startFilter("targetUserId", e.target.value)}
          placeholder="Buscar por ID de usuario…"
          inputMode="numeric"
        />
      </label>
      <label className="audit-logs-toolbar__field">
        <span>Desde</span>
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => startFilter("dateFrom", e.target.value)}
        />
      </label>
      <label className="audit-logs-toolbar__field">
        <span>Hasta</span>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => startFilter("dateTo", e.target.value)}
        />
      </label>
      <label className="audit-logs-toolbar__field">
        <span>Por página</span>
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
        onClick={() => void fetchAuditLogs(filters)}
      >
        <RefreshCw size={18} aria-hidden />
        Actualizar
      </Button>
    </div>
  );

  if (loader && items.length === 0) {
    return (
      <AdminPageLayout
        title="Auditoría de Admin"
        subtitle="Trazabilidad de acciones críticas realizadas desde administración."
      >
        <div className="flex justify-center py-12">
          <Spinner size={3} width={0.3} color="var(--app-accent)" />
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title={`Auditoría de Admin — ${total}`}
      subtitle="Filtra por fecha, acción y usuario objetivo para saber quién hizo qué."
      toolbar={toolbar}
    >
      {error && (
        <div className="admin-error-strip">
          <p>{error}</p>
        </div>
      )}

      <div className="admin-table-panel">
        <div
          className="overflow-x-auto max-h-[62vh] overflow-y-auto"
          tabIndex={0}
          role="region"
          aria-label="Tabla de auditoría admin"
          data-scroll-region
        >
          <table className="w-full min-w-full lg:min-w-[1100px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Fecha</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Acción</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Admin</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Objetivo</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Metadata</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">IP</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">User-Agent</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-5 px-4 text-sm text-center audit-logs-empty">
                    No hay registros para los filtros seleccionados.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="border-b transition-colors">
                  <td className="py-3 px-4 text-sm whitespace-nowrap">
                    {formatDateTime(item.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <span className="audit-logs-action">{item.action}</span>
                  </td>
                  <td className="py-3 px-4 text-sm">#{item.actorUserId}</td>
                  <td className="py-3 px-4 text-sm">
                    {item.targetUserId ? `#${item.targetUserId}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <code title={JSON.stringify(item.metadata)}>{formatMetadata(item.metadata)}</code>
                  </td>
                  <td className="py-3 px-4 text-sm">{item.ip || "—"}</td>
                  <td className="py-3 px-4 text-sm">
                    <span
                      className="audit-logs-user-agent"
                      title={item.userAgent || ""}
                    >
                      {item.userAgent || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} className="py-3 px-4">
                  <Pagination
                    totalData={total}
                    title="registros"
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

      <div className="admin-mobile-list">
        {items.length > 0 ? (
          items.map((item) => (
            <Button unstyled
              key={`m_${item.id}`}
              className="admin-mobile-card"
              onClick={() => setDrawerItem(item)}
              type="button"
            >
              <div className="admin-mobile-card__head">
                <div className="admin-mobile-card__identity">
                  <div className="admin-mobile-card__avatar">
                    {String(item.actorUserId).slice(-2)}
                  </div>
                  <div className="admin-mobile-card__copy">
                    <p className="admin-mobile-card__name">{item.action}</p>
                    <p className="admin-mobile-card__email">Admin #{item.actorUserId}</p>
                  </div>
                </div>
                <span className="admin-mobile-status is-active">
                  {item.targetUserId ? `Obj #${item.targetUserId}` : "Sin objetivo"}
                </span>
                <span className="admin-mobile-card__menu" aria-hidden>
                  <MoreVertical size={20} />
                </span>
              </div>
              <div className="admin-mobile-card__foot">
                <span>{formatDateTime(item.createdAt)}</span>
                <span>{item.ip || "IP —"}</span>
              </div>
            </Button>
          ))
        ) : (
          <div className="px-4 py-6 text-center">
            <p className="text-text-main text-sm font-medium">No hay registros para los filtros seleccionados.</p>
            <p className="text-text-muted text-xs mt-1">Ajusta los filtros para ver actividad reciente.</p>
          </div>
        )}
      </div>

      <div className="admin-pagination-mobile">
        <Pagination
          totalData={total}
          title="registros"
          startFilter={startFilter}
          currentPage={filters.page}
          limit={filters.limit}
          totalLoader={totalLoader}
        />
      </div>

      <AdminDrawer
        open={drawerItem !== null}
        onClose={() => setDrawerItem(null)}
        title={drawerItem?.action ?? "Registro"}
        user={undefined}
      >
        {drawerItem && (
          <div className="space-y-2 text-sm">
            <p><span className="text-text-muted">Fecha:</span> {formatDateTime(drawerItem.createdAt)}</p>
            <p><span className="text-text-muted">Acción:</span> {drawerItem.action}</p>
            <p><span className="text-text-muted">Admin:</span> #{drawerItem.actorUserId}</p>
            <p><span className="text-text-muted">Objetivo:</span> {drawerItem.targetUserId ? `#${drawerItem.targetUserId}` : "—"}</p>
            <p><span className="text-text-muted">Metadata:</span> {formatMetadata(drawerItem.metadata)}</p>
            <p><span className="text-text-muted">IP:</span> {drawerItem.ip || "—"}</p>
            <p><span className="text-text-muted">User-Agent:</span> {drawerItem.userAgent || "—"}</p>
          </div>
        )}
      </AdminDrawer>
    </AdminPageLayout>
  );
};
