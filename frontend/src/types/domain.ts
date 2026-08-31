export type Severity = "critical" | "high" | "medium" | "low";
export type WorkflowStatus =
  "new" | "verified" | "analysing" | "monitoring" | "closed";
export interface Point {
  lat: number;
  lon: number;
}
export interface SpillGeometry {
  centroid: Point;
  areaKm2: number;
  perimeterKm: number;
  majorAxisKm: number;
  minorAxisKm: number;
  orientationDeg: number;
  compactness: number;
  shorelineDistanceKm: number;
  outline: Point[];
}
export interface OilSpillIncident {
  id: string;
  simulated: boolean;
  location: string;
  region: string;
  firstDetected: string;
  lastObserved: string;
  sensor: "SAR" | "EO" | "SAR + EO";
  confidence: number;
  severity: Severity;
  status: WorkflowStatus;
  assignedAnalyst: string;
  estimatedAgeHours: [number, number];
  driftBearing: number;
  geometry: SpillGeometry;
  coastalProximityKm: number;
}
export interface SatelliteScene {
  id: string;
  incidentId: string;
  sensor: "SAR" | "EO";
  acquiredAt: string;
  orbit: string;
  pass: "Ascending" | "Descending";
  state: "ready" | "processing";
  cloudCover?: number;
  previewUrl?: string;
  footprint?: Point[];
  productType?: string;
  polarizations?: string[];
}
export interface EnvironmentalVector {
  kind: "current" | "wind";
  speed: number;
  direction: number;
  unit: "m/s" | "kn";
}
export interface DriftSnapshot {
  id: string;
  incidentId: string;
  at: string;
  phase: "hindcast" | "observation" | "forecast";
  centroid: Point;
  areaKm2: number;
  uncertaintyKm: number;
  vectors: EnvironmentalVector[];
}
export interface VesselTrackPoint extends Point {
  at: string;
  speedKn: number;
  course: number;
  quality: "reported" | "reconstructed" | "gap";
}
export interface AISVessel {
  id: string;
  name: string;
  imo: string;
  mmsi: string;
  synthetic: boolean;
  type: string;
  flag: string;
  dimensions: string;
  destination: string;
  lastUpdate: string;
  track: VesselTrackPoint[];
  aisGapHours: number;
  loitering: number;
  identityIssue: boolean;
  relevance: "candidate" | "relevant" | "excluded";
}
export interface ScoreBreakdown {
  proximity: number;
  temporal: number;
  trajectory: number;
  anomaly: number;
  dataQuality: number;
  environmental: number;
  penalty: number;
}
export interface SuspectCandidate {
  id: string;
  incidentId: string;
  vesselId: string;
  score: number;
  closestApproachKm: number;
  timeOffsetHours: number;
  breakdown: ScoreBreakdown;
  flags: string[];
  evidenceStatus: "requires review" | "insufficient" | "reviewed";
}
export interface CaseRecord {
  id: string;
  incidentId: string;
  status: "open" | "investigating" | "review" | "closed";
  priority: Severity;
  assignedAnalyst: string;
  createdAt: string;
  updatedAt: string;
  evidenceCompleteness: number;
  nextAction: string;
  notes: string[];
  pinnedEvidence: string[];
  savedScenarios: string[];
}
export interface Alert {
  id: string;
  incidentId?: string;
  level: Severity;
  message: string;
  at: string;
  read: boolean;
}
export interface ModelRun {
  id: string;
  incidentId?: string;
  model: string;
  version: string;
  startedAt: string;
  durationMs: number;
  status: "success" | "running" | "failed";
  confidence?: number;
  source: "mock" | "demo";
}
export interface DataAsset {
  id: string;
  name: string;
  kind: string;
  format: string;
  records?: number;
  entities?: number;
  bytes: number;
  status: "available" | "missing";
}
export interface Sourced<T> {
  source: "mock" | "demo";
  data: T;
}
