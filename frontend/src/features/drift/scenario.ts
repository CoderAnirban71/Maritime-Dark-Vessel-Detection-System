import type { DriftSnapshot } from "../../types/domain";
export interface Scenario {
  windSpeed: number;
  windDirection: number;
  currentSpeed: number;
  currentDirection: number;
  window: number;
}
export const BASELINE: Scenario = {
  windSpeed: 12.4,
  windDirection: 251,
  currentSpeed: 0.48,
  currentDirection: 238,
  window: 72,
};
export const interpolate = (
  a: DriftSnapshot,
  b: DriftSnapshot,
  t: number,
): DriftSnapshot => ({
  ...a,
  id: `${a.id}-${b.id}-${t}`,
  at: new Date(
    Date.parse(a.at) + (Date.parse(b.at) - Date.parse(a.at)) * t,
  ).toISOString(),
  centroid: {
    lat: a.centroid.lat + (b.centroid.lat - a.centroid.lat) * t,
    lon: a.centroid.lon + (b.centroid.lon - a.centroid.lon) * t,
  },
  areaKm2: a.areaKm2 + (b.areaKm2 - a.areaKm2) * t,
  uncertaintyKm: a.uncertaintyKm + (b.uncertaintyKm - a.uncertaintyKm) * t,
});
export const adjustSnapshots = (items: DriftSnapshot[], s: Scenario) =>
  items.map((x, i) => ({
    ...x,
    centroid: {
      lat:
        x.centroid.lat +
        Math.sin((s.windDirection * Math.PI) / 180) *
          (s.windSpeed - BASELINE.windSpeed) *
          i *
          0.002,
      lon:
        x.centroid.lon +
        Math.cos((s.currentDirection * Math.PI) / 180) *
          (s.currentSpeed - BASELINE.currentSpeed) *
          i *
          0.05,
    },
    uncertaintyKm:
      x.uncertaintyKm + Math.abs(s.windSpeed - BASELINE.windSpeed) * 0.08,
  }));
