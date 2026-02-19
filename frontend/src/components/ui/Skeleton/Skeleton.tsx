import "./Skeleton.scss";

type SkeletonRowProps = {
  className?: string;
  width?: string;
  height?: string;
};

type SkeletonCardProps = {
  className?: string;
};

type SkeletonTableProps = {
  className?: string;
  rows?: number;
  rowClassName?: string;
};

export function SkeletonRow(props: SkeletonRowProps) {
  const { className, width, height } = props;
  return (
    <span
      className={["bb-skeleton", "bb-skeleton-row", className ?? ""].filter(Boolean).join(" ")}
      style={{
        width: width ?? "100%",
        height: height ?? undefined,
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard(props: SkeletonCardProps) {
  const { className } = props;
  return (
    <article className={["bb-skeleton-card", className ?? ""].filter(Boolean).join(" ")} aria-hidden="true">
      <span className="bb-skeleton bb-skeleton-card__media" />
      <div className="bb-skeleton-card__content">
        <SkeletonRow className="bb-skeleton-card__line bb-skeleton-card__line--title" />
        <SkeletonRow className="bb-skeleton-card__line bb-skeleton-card__line--body" />
      </div>
    </article>
  );
}

export function SkeletonTable(props: SkeletonTableProps) {
  const { className, rows = 5, rowClassName } = props;
  return (
    <div className={["bb-skeleton-table", className ?? ""].filter(Boolean).join(" ")} aria-hidden="true">
      {Array.from({ length: rows }).map((_, idx) => (
        <SkeletonRow key={`sk-row-${idx}`} className={rowClassName} />
      ))}
    </div>
  );
}
