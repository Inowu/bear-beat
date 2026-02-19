import React from "react";
import "./Card.scss";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
};

export function Card(props: CardProps) {
  const {
    children,
    hover = false,
    padding = "md",
    className,
    ...rest
  } = props;

  return (
    <div
      {...rest}
      className={[
        "bb-ui-card",
        `bb-ui-card--padding-${padding}`,
        hover ? "bb-ui-card--hover" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
