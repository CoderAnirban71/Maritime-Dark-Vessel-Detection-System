import type { HTMLAttributes, ReactNode } from "react";
import { AlertTriangle, Box, RefreshCw } from "lucide-react";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "coral" | "citron" | "teal" | "yellow" | "blue";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Panel({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section className={`panel ${className}`} {...props}>
      {children}
    </section>
  );
}
export function PanelHead({
  index,
  title,
  aside,
}: {
  index?: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="panel-head">
      {index && <span className="index">{index}</span>}
      <h2>{title}</h2>
      {aside && <div>{aside}</div>}
    </div>
  );
}
export function EmptyState({
  title = "No results",
  detail = "Adjust the active filters and try again.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="state">
      <Box />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="state error" role="alert">
      <AlertTriangle />
      <strong>Data unavailable</strong>
      <span>{message}</span>
      {retry && (
        <button onClick={retry}>
          <RefreshCw /> Retry
        </button>
      )}
    </div>
  );
}
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}
export function ScoreBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="score" aria-label={`${label ?? "Score"} ${value} percent`}>
      <span style={{ width: `${value}%` }} />
      <b>{value}</b>
    </div>
  );
}
