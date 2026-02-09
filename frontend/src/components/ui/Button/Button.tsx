import React from "react";
import "./Button.scss";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "sm";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    loading = false,
    leftIcon,
    rightIcon,
    disabled,
    className,
    children,
    ...rest
  } = props;

  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        "bb-btn",
        `bb-btn--${variant}`,
        `bb-btn--${size}`,
        loading ? "is-loading" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {loading ? (
        <span className="bb-btn__spinner" aria-hidden />
      ) : leftIcon ? (
        <span className="bb-btn__icon" aria-hidden>
          {leftIcon}
        </span>
      ) : null}
      <span className="bb-btn__label">{children}</span>
      {rightIcon ? (
        <span className="bb-btn__icon" aria-hidden>
          {rightIcon}
        </span>
      ) : null}
    </button>
  );
}

