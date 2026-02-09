import React from "react";
import "./Select.scss";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
};

export function Select(props: SelectProps) {
  const { hasError, className, children, ...rest } = props;
  return (
    <select
      {...rest}
      aria-invalid={hasError || undefined}
      className={["bb-select", hasError ? "is-invalid" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </select>
  );
}

