import React from "react";
import "./Input.scss";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export function Input(props: InputProps) {
  const { hasError, className, ...rest } = props;
  return (
    <input
      {...rest}
      aria-invalid={hasError || undefined}
      className={["bb-input", hasError ? "is-invalid" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

