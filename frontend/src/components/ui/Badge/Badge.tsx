import React from "react";
import "./Badge.scss";

export type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "outline";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children?: React.ReactNode;
  size?: "sm" | "md";
  dot?: boolean;
};

export function Badge(props: BadgeProps) {
  const {
    variant = "default",
    size = "md",
    dot = false,
    className,
    children,
    ...rest
  } = props;

  return (
    <span
      {...rest}
      className={[
        "bb-ui-badge",
        `bb-ui-badge--${variant}`,
        `bb-ui-badge--${size}`,
        dot ? "bb-ui-badge--dot" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {dot ? null : children}
    </span>
  );
}
