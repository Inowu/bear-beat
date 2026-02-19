import type { AppIcon } from "src/icons";
import {
  Activity,
  Ban,
  BarChart3,
  Database,
  Download,
  FileText,
  Mail,
  Phone,
  Receipt,
  ShoppingCart,
  Ticket,
  Users,
} from "src/icons";

export type AdminNavigationGroupId =
  | "operations"
  | "commerce"
  | "analytics"
  | "security";

export interface AdminNavigationItem {
  to: string;
  label: string;
  Icon: AppIcon;
  aliases?: string[];
}

export interface AdminNavigationGroup {
  id: AdminNavigationGroupId;
  label: string;
  items: AdminNavigationItem[];
}

export const ADMIN_NAVIGATION_GROUPS: AdminNavigationGroup[] = [
  {
    id: "operations",
    label: "Operación",
    items: [
      { to: "/admin/usuarios", label: "Usuarios", Icon: Users },
      { to: "/admin/ordenes", label: "Órdenes", Icon: Receipt },
      {
        to: "/admin/historial-checkout",
        label: "Checkout",
        Icon: FileText,
        aliases: ["/admin/historialCheckout"],
      },
      { to: "/admin/historial-descargas", label: "Descargas", Icon: Download },
    ],
  },
  {
    id: "commerce",
    label: "Comercial",
    items: [
      {
        to: "/admin/planes",
        label: "Planes",
        Icon: ShoppingCart,
        aliases: ["/admin/planesAdmin"],
      },
      { to: "/admin/cupones", label: "Cupones", Icon: Ticket },
    ],
  },
  {
    id: "analytics",
    label: "Analítica",
    items: [
      { to: "/admin/catalogo", label: "Catálogo", Icon: BarChart3 },
      { to: "/admin/analitica", label: "Analítica", Icon: BarChart3 },
      { to: "/admin/crm", label: "CRM", Icon: Users },
      { to: "/admin/live", label: "Live", Icon: Activity },
    ],
  },
  {
    id: "security",
    label: "Seguridad y sistema",
    items: [
      { to: "/admin/audit-logs", label: "Auditoría", Icon: FileText },
      { to: "/admin/webhook-inbox", label: "Webhook Inbox", Icon: Activity },
      { to: "/admin/email-templates", label: "Emails", Icon: Mail },
      { to: "/admin/dominios-bloqueados", label: "Dominios", Icon: Ban },
      { to: "/admin/telefonos-bloqueados", label: "Teléfonos", Icon: Phone },
      { to: "/admin/almacenamiento", label: "Almacenamiento", Icon: Database },
    ],
  },
];

export const ADMIN_NAVIGATION_ITEMS: AdminNavigationItem[] = ADMIN_NAVIGATION_GROUPS.flatMap(
  (group) => group.items,
);

const normalizePath = (pathname: string): string => {
  const clean = pathname.trim();
  if (!clean) return "";
  return clean.endsWith("/") && clean !== "/" ? clean.slice(0, -1) : clean;
};

export function getAdminNavigationItem(pathname: string): AdminNavigationItem | null {
  const normalizedPath = normalizePath(pathname);
  if (!normalizedPath) return null;

  return (
    ADMIN_NAVIGATION_ITEMS.find((item) => {
      const canonicalMatch = normalizePath(item.to) === normalizedPath;
      if (canonicalMatch) return true;
      return Boolean(item.aliases?.some((alias) => normalizePath(alias) === normalizedPath));
    }) ?? null
  );
}
