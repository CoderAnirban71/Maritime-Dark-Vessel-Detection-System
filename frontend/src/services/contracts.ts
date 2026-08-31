import type {
  AISVessel,
  CaseRecord,
  DriftSnapshot,
  DataAsset,
  ModelRun,
  OilSpillIncident,
  SatelliteScene,
  Sourced,
  SuspectCandidate,
} from "../types/domain";
export interface IncidentService {
  list(signal?: AbortSignal): Promise<Sourced<OilSpillIncident[]>>;
  get(id: string, signal?: AbortSignal): Promise<Sourced<OilSpillIncident>>;
}
export interface ImageryService {
  list(incidentId: string): Promise<Sourced<SatelliteScene[]>>;
  run(incidentId: string): Promise<Sourced<ModelRun>>;
  startAnalysis?(incidentId: string): Promise<AnalysisJob>;
  analysisStatus?(jobId: string): Promise<AnalysisJob>;
}
export interface AnalysisJob {
  jobId: string;
  status: "running" | "complete" | "failed";
  progress: number;
  stage: string;
  error?: string;
  result?: {
    environmentalSamples: number;
    vesselTracks: number;
    meanCurrentMs: number;
    meanWindMs: number;
  };
  completedAt?: string;
}
export interface DriftService {
  list(
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<Sourced<DriftSnapshot[]>>;
}
export interface AISService {
  list(
    incidentId?: string,
    signal?: AbortSignal,
  ): Promise<Sourced<AISVessel[]>>;
}
export interface AttributionService {
  rank(incidentId: string): Promise<Sourced<SuspectCandidate[]>>;
}
export interface CaseService {
  list(): Promise<Sourced<CaseRecord[]>>;
  save(value: CaseRecord): Promise<Sourced<CaseRecord>>;
}
export interface ModelService {
  runs(): Promise<Sourced<ModelRun[]>>;
  datasets(): Promise<Sourced<DataAsset[]>>;
  health(): Promise<{ ok: boolean; message: string; latencyMs?: number }>;
}
export interface Services {
  incidents: IncidentService;
  imagery: ImageryService;
  drift: DriftService;
  ais: AISService;
  attribution: AttributionService;
  cases: CaseService;
  models: ModelService;
}
