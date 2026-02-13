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

/** Contenedor para todas las secciones del admin: usa --ad-* (respeta Dark/Light). Título mismo impacto que Home (H1). */
export function AdminPageLayout({
  title,
  subtitle,
  toolbar,
  className,
  children,
}: AdminPageLayoutProps) {
  const classes = className ? `admin-page-wrap ${className}` : "admin-page-wrap";
  return (
    <div className={classes}>
      <h1 className="admin-page-wrap__title">{title}</h1>
      {subtitle && <p className="admin-page-wrap__subtitle">{subtitle}</p>}
      {toolbar && <div className="admin-page-wrap__toolbar">{toolbar}</div>}
      {children}
    </div>
  );
}
