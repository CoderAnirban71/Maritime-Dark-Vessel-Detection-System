export const formatUtc = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }).format(new Date(value)) + " UTC";
export const formatNumber = (n: number, digits = 1) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(n);
export const formatCoord = (n: number, pos: string, neg: string) =>
  `${Math.abs(n).toFixed(3)}° ${n >= 0 ? pos : neg}`;
export const formatDuration = (hours: number) =>
  hours < 1 ? `${Math.round(hours * 60)} min` : `${formatNumber(hours)} h`;
export const clamp = (n: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, n));
