import type {
  OilSpillIncident,
  Severity,
  WorkflowStatus,
} from "../../types/domain";
const severityRank: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};
export const urgency = (i: OilSpillIncident) =>
  severityRank[i.severity] * 30 +
  i.confidence * 20 +
  Math.max(0, 24 - (Date.now() - Date.parse(i.lastObserved)) / 3600000) -
  i.coastalProximityKm * 0.2;
export const sortByUrgency = (items: OilSpillIncident[]) =>
  [...items].sort((a, b) => urgency(b) - urgency(a));
export interface OverviewFilters {
  query: string;
  severity: "all" | Severity;
  status: "all" | WorkflowStatus;
  region: string;
}
export const filterIncidents = (
  items: OilSpillIncident[],
  f: OverviewFilters,
) =>
  items.filter(
    (i) =>
      (!f.query ||
        `${i.id} ${i.location}`
          .toLowerCase()
          .includes(f.query.toLowerCase())) &&
      (f.severity === "all" || i.severity === f.severity) &&
      (f.status === "all" || i.status === f.status) &&
      (f.region === "all" || i.region === f.region),
  );
export const project = ({ lat, lon }: { lat: number; lon: number }) => ({
  x: ((lon + 180) / 360) * 100,
  y: ((90 - lat) / 180) * 100,
});
