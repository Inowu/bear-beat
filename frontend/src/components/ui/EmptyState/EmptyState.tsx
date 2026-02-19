import React from "react";
import { FolderDown, FolderOpen, Search, WifiOff } from "src/icons";
import "./EmptyState.scss";

export type EmptyStateVariant =
  | "folder-empty"
  | "search-empty"
  | "connection-error"
  | "downloads-empty";

type EmptyStateTone = "neutral" | "danger";

type EmptyStateProps = {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  tone?: EmptyStateTone;
};

const EMPTY_STATE_PRESETS: Record<
  EmptyStateVariant,
  {
    title: string;
    description: string;
    icon: React.ReactNode;
    tone: EmptyStateTone;
  }
> = {
  "folder-empty": {
    title: "Carpeta vacía",
    description: "Esta carpeta no tiene archivos todavía.",
    icon: <FolderOpen aria-hidden />,
    tone: "neutral",
  },
  "search-empty": {
    title: "Sin resultados",
    description: "No encontramos coincidencias con tu búsqueda.",
    icon: <Search aria-hidden />,
    tone: "neutral",
  },
  "connection-error": {
    title: "No pudimos cargar",
    description: "Revisa tu conexión e intenta nuevamente.",
    icon: <WifiOff aria-hidden />,
    tone: "danger",
  },
  "downloads-empty": {
    title: "Sin descargas aún",
    description: "Cuando descargues carpetas o archivos, aparecerán aquí.",
    icon: <FolderDown aria-hidden />,
    tone: "neutral",
  },
};

export function EmptyState(props: EmptyStateProps) {
  const { variant, title, description, icon, action, tone } = props;
  const preset = variant ? EMPTY_STATE_PRESETS[variant] : null;
  const resolvedTitle = title ?? preset?.title ?? "Sin datos disponibles";
  const resolvedDescription = description ?? preset?.description;
  const resolvedIcon = icon ?? preset?.icon;
  const resolvedTone = tone ?? preset?.tone ?? "neutral";

  return (
    <section className={`bb-empty bb-empty--${resolvedTone}`} aria-label={resolvedTitle}>
      {resolvedIcon ? (
        <div className="bb-empty__icon" aria-hidden>
          {resolvedIcon}
        </div>
      ) : null}
      <h2 className="bb-empty__title">{resolvedTitle}</h2>
      {resolvedDescription ? <p className="bb-empty__desc">{resolvedDescription}</p> : null}
      {action ? <div className="bb-empty__action">{action}</div> : null}
    </section>
  );
}
