import React from "react";
import "./AdminPageLayout.scss";

interface AdminPageLayoutProps {
  title: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

/** Contenedor para todas las secciones del admin: usa --ad-* (respeta Dark/Light). Título mismo impacto que Home (H1). */
export function AdminPageLayout({ title, toolbar, children }: AdminPageLayoutProps) {
  return (
    <div className="admin-page-wrap">
      <h1 className="admin-page-wrap__title">{title}</h1>
      {toolbar && <div className="admin-page-wrap__toolbar">{toolbar}</div>}
      {children}
    </div>
  );
}
