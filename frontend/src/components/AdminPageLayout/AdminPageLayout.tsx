import React from "react";

interface AdminPageLayoutProps {
  title: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

/** Contenedor God Mode para todas las secciones del admin: bg-slate-950, título, barra de herramientas opcional */
export function AdminPageLayout({ title, toolbar, children }: AdminPageLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 p-4 font-sans">
      <h1 className="text-white text-2xl font-bold mb-6" style={{ fontFamily: "Poppins, sans-serif" }}>
        {title}
      </h1>
      {toolbar && (
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          {toolbar}
        </div>
      )}
      {children}
    </div>
  );
}
