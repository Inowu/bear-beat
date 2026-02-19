import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import "./AdminPageLayout.scss";
import "../../pages/Admin/Admin.scss";
import { Select } from "src/components/ui";
import {
  ADMIN_NAVIGATION_GROUPS,
  getAdminNavigationItem,
} from "../../constants/adminNavigation";

interface AdminPageLayoutProps {
  title: string;
  subtitle?: string;
  toolbar?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Contenedor para todas las secciones del admin: usa --ad-* (respeta Dark/Light). Título mismo impacto que Home (H1). */
export function AdminPageLayout({
  title,
  subtitle,
  toolbar,
  className,
  children,
}: AdminPageLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const currentNavItem = getAdminNavigationItem(location.pathname);
  const currentGroup = currentNavItem
    ? ADMIN_NAVIGATION_GROUPS.find((group) =>
      group.items.some((item) => item.to === currentNavItem.to),
    )
    : null;

  const classes = className ? `admin-page-wrap bb-app-page ${className}` : "admin-page-wrap bb-app-page";
  return (
    <div className={classes}>
      <h1 className="admin-page-wrap__title">{title}</h1>
      {subtitle && <p className="admin-page-wrap__subtitle">{subtitle}</p>}
      {currentNavItem && currentGroup && (
        <section className="admin-page-wrap__context-nav" aria-label="Navegación rápida de admin">
          <div className="admin-page-wrap__context-head">
            <p className="admin-page-wrap__context-kicker">Admin · {currentGroup.label}</p>
            <p className="admin-page-wrap__context-current">Estás en: {currentNavItem.label}</p>
          </div>
          <div className="admin-page-wrap__context-controls">
            <label htmlFor="admin-route-switcher">Cambiar sección</label>
            <Select
              id="admin-route-switcher"
              value={currentNavItem.to}
              onChange={(event) => {
                const nextPath = event.target.value;
                if (!nextPath || nextPath === location.pathname) return;
                navigate(nextPath);
              }}
            >
              {ADMIN_NAVIGATION_GROUPS.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {group.items.map((item) => (
                    <option key={item.to} value={item.to}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
          <nav className="admin-page-wrap__context-links" aria-label={`Atajos de ${currentGroup.label}`}>
            {currentGroup.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `admin-page-wrap__context-link${isActive ? " is-active" : ""}`
                }
              >
                <item.Icon size={16} aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </section>
      )}
      {toolbar && <div className="admin-page-wrap__toolbar">{toolbar}</div>}
      {children}
    </div>
  );
}
