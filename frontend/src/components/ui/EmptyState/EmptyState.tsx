import React from "react";
import "./EmptyState.scss";

export function EmptyState(props: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "neutral" | "danger";
}) {
  const { title, description, icon, action, tone = "neutral" } = props;
  return (
    <section className={`bb-empty bb-empty--${tone}`} aria-label={title}>
      {icon ? (
        <div className="bb-empty__icon" aria-hidden>
          {icon}
        </div>
      ) : null}
      <h2 className="bb-empty__title">{title}</h2>
      {description ? <p className="bb-empty__desc">{description}</p> : null}
      {action ? <div className="bb-empty__action">{action}</div> : null}
    </section>
  );
}

