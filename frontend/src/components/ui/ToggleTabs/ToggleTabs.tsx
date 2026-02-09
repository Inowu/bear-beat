import React, { useCallback } from "react";
import "./ToggleTabs.scss";

export type ToggleTabOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

export function ToggleTabs<T extends string>(props: {
  value: T;
  onChange: (value: T) => void;
  options: Array<ToggleTabOption<T>>;
  ariaLabel: string;
  className?: string;
}) {
  const { value, onChange, options, ariaLabel, className } = props;

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(e.key)) return;
      e.preventDefault();

      const enabled = options.filter((o) => !o.disabled);
      const currentIndex = enabled.findIndex((o) => o.value === value);
      if (currentIndex === -1) return;

      const nextIndex =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? enabled.length - 1
            : e.key === "ArrowLeft"
              ? Math.max(0, currentIndex - 1)
              : Math.min(enabled.length - 1, currentIndex + 1);

      const next = enabled[nextIndex];
      if (next) onChange(next.value);
    },
    [onChange, options, value],
  );

  return (
    <div
      className={["bb-tabs", className ?? ""].filter(Boolean).join(" ")}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={opt.disabled}
            className={["bb-tabs__tab", selected ? "is-active" : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon ? (
              <span className="bb-tabs__icon" aria-hidden>
                {opt.icon}
              </span>
            ) : null}
            <span className="bb-tabs__label">{opt.label}</span>
            {opt.description ? (
              <span className="bb-tabs__desc">{opt.description}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

