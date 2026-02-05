import { useEffect } from "react";
import { X } from "lucide-react";
import { IAdminUser } from "../../interfaces/admin";
import "./AdminDrawer.scss";

export interface AdminDrawerAction {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}

interface AdminDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  user?: IAdminUser | null;
  children?: React.ReactNode;
  actions?: AdminDrawerAction[];
}

export function AdminDrawer({
  open,
  onClose,
  title,
  user,
  children,
  actions = [],
}: AdminDrawerProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="admin-drawer-backdrop"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Cerrar"
      />
      <div className={`admin-drawer ${open ? "admin-drawer--open" : ""}`}>
        <div className="admin-drawer__handle" aria-hidden />
        <div className="admin-drawer__header">
          <h2 className="admin-drawer__title">{title}</h2>
          <button
            type="button"
            className="admin-drawer__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="admin-drawer__body">
          {user && (
            <div className="admin-drawer__user-summary">
              <div className="admin-drawer__avatar">
                {(user.username || user.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="admin-drawer__user-info">
                <span className="admin-drawer__user-name">{user.username}</span>
                <span className="admin-drawer__user-email">{user.email}</span>
                {user.phone && (
                  <span className="admin-drawer__user-meta">{user.phone}</span>
                )}
                <span className="admin-drawer__user-meta">
                  Registro: {user.registered_on.toLocaleDateString()}
                </span>
              </div>
            </div>
          )}
          {children}
          {actions.length > 0 && (
            <div className="admin-drawer__actions">
              {actions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`admin-drawer__btn admin-drawer__btn--${a.variant ?? "secondary"}`}
                  onClick={() => {
                    a.onClick();
                    onClose();
                  }}
                  disabled={a.disabled}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
