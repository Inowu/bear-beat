import React from "react";
import "./AdminPageLayout.scss";
import "../../pages/Admin/Admin.scss";

interface AdminPageLayoutProps {
  title: string;
  subtitle?: string;
  toolbar?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Contenedor para todas las secciones del admin: usa --ad-* (respeta Dark/Light). */
export function AdminPageLayout({
  title,
  subtitle,
  toolbar,
  className,
  children,
}: AdminPageLayoutProps) {
  const classes = className ? `admin-page-wrap bb-app-page ${className}` : "admin-page-wrap bb-app-page";
  return (
    <div className={classes}>
      <header className="admin-page-wrap__header">
        <h2 className="admin-page-wrap__title">{title}</h2>
        {subtitle && <p className="admin-page-wrap__subtitle">{subtitle}</p>}
      </header>
      {toolbar && <div className="admin-page-wrap__toolbar">{toolbar}</div>}
      {children}
    </div>
  );
}

