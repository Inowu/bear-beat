import React from "react";
import "./Alert.scss";

type AlertTone = "info" | "success" | "warning" | "danger";

export function Alert(props: {
  tone?: AlertTone;
  title?: string;
  children: React.ReactNode;
  className?: string;
  role?: "alert" | "status" | "note";
}) {
  const { tone = "info", title, children, className, role } = props;
  return (
    <div
      className={["bb-alert", `bb-alert--${tone}`, className ?? ""]
        .filter(Boolean)
        .join(" ")}
      role={role ?? (tone === "danger" ? "alert" : "status")}
    >
      {title ? <div className="bb-alert__title">{title}</div> : null}
      <div className="bb-alert__body">{children}</div>
    </div>
  );
}

