import "./Spinner.scss";

interface SpinnerProps {
  size: number;
  width: number;
  color?: string;
  label?: string;
}
export function Spinner(props: SpinnerProps) {
  const label = props.label ?? "Cargando...";
  return (
    <div className="bb-spinner-wrap" role="status" aria-live="polite" aria-busy="true">
      <div
        className="bb-spinner"
        style={{
          width: `${props.size}rem`,
          height: `${props.size}rem`,
          borderWidth: `${props.width}rem`,
          color: props.color ?? "var(--app-accent)",
        }}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
