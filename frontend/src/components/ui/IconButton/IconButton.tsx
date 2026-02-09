import React from "react";
import "./IconButton.scss";

type IconButtonVariant = "ghost" | "secondary" | "danger";

export type IconButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  label: string;
  icon: React.ReactNode;
  variant?: IconButtonVariant;
};

export function IconButton(props: IconButtonProps) {
  const { label, icon, variant = "ghost", className, ...rest } = props;
  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      aria-label={label}
      className={[
        "bb-icon-btn",
        `bb-icon-btn--${variant}`,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="bb-icon-btn__icon" aria-hidden>
        {icon}
      </span>
    </button>
  );
}

