/**
 * Samudra-Netra Intelligence Platform - Core Type Definitions
 * SIH Problem Statement 26143:
 * "Leveraging satellite imagery to determine Oil spills at sea along with AIS data correlations to identify vessel responsible for the spill."
 */

// ==========================================
// 1. DATA PROVENANCE & TRUST LEVELS
// ==========================================
export type DataProvenance = 'OBSERVED' | 'DERIVED' | 'ESTIMATED' | 'SIMULATED';

export interface ProvenanceMeta {
  provenance: DataProvenance;
  source: string; // e.g. "Sentinel-1A C-Band SAR", "Class-A AIS Base Station", "OpenDrift Hindcast Model"
  confidence?: number; // 0-100%
  timestamp?: string;
  notes?: string;
}

// ==========================================
// 2. GEOSPATIAL & SLICK GEOMETRY
// ==========================================
export interface LatLng {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface SlickGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: [number, number][][]; // [lat, lng] pairs for UI map rendering
  center: LatLng;
  bbox: BoundingBox;
  areaKm2: number;
  lengthKm: number;
  widthKm: number;
  perimeterKm: number;
  provenance: DataProvenance;
}

// ==========================================
// 3. SATELLITE OBSERVATION
// ==========================================
export type SatellitePlatform = 'Sentinel-1A' | 'Sentinel-1B' | 'Sentinel-2' | 'RADARSAT-2' | 'TerraSAR-X' | 'Landsat-8/9';
export type SensorType = 'SAR_C_BAND' | 'SAR_X_BAND' | 'OPTICAL_MULTISPECTRAL' | 'THERMAL_INFRARED';
export type SARPolarization = 'VV' | 'VH' | 'HH' | 'HV' | 'VV+VH' | 'HH+HV';
export type AcquisitionMode = 'IW' | 'EW' | 'SM' | 'WV';

export interface SatelliteObservation {
  id: string;
  spillId: string;
  platform: SatellitePlatform;
  sensor: SensorType;
  polarization: SARPolarization;
  mode: AcquisitionMode;
  acquisitionTime: string; // ISO UTC
  orbitPass: 'ASCENDING' | 'DESCENDING';
  relativeOrbit: number;
  incidenceAngleRange: [number, number]; // degrees (e.g. [31.5, 42.1])
  resolutionMeters: number;
  rawGranuleId: string;
  quicklookUrl: string;
  thumbnailUrl?: string;
  overlayBounds?: [[number, number], [number, number], [number, number], [number, number]]; // 4-corner polygon
  darkPatchContrastDb: number; // Backscatter attenuation (e.g. -4.8 dB)
  windSpeedAtAcquisitionKnots?: number; // Knots
  provenance: DataProvenance; // OBSERVED
}

// ==========================================
// 4. OIL SPILL INCIDENT
// ==========================================
export type SpillCategory = 'MINERAL_OIL_BUNKER' | 'CRUDE_OIL' | 'REFINED_PRODUCT' | 'VEGETABLE_OIL' | 'UNKNOWN_HYDROCARBON';
export type SpillStatus = 'detected' | 'under_investigation' | 'attributed' | 'closed';

export interface OilSpill {
  id: string;
  code: string; // e.g. "OS-2017-ENNORE-01"
  name: string;
  detectionTime: string; // ISO UTC
  status: SpillStatus;
  category: SpillCategory;
  location: {
    lat: number;
    lng: number;
    seaArea: string; // e.g. "Bay of Bengal - Kamarajar Port / Ennore", "Arabian Sea - Mumbai High"
    countryEez: string;
    distanceToCoastKm: number;
  };
  geometry: SlickGeometry;
  estimatedVolumeM3?: number; // Estimated volume
  estimatedAgeHours: number; // Derived/Estimated age based on spreading/weathering
  thicknessMicrons?: number; // Estimated mean thickness (Bonn Agreement code)
  confidenceScore: number; // 0-100%
  satelliteObservation: SatelliteObservation;
  tags: string[];
  provenance: DataProvenance;
}

// ==========================================
// 5. AIS RECORDS & VESSEL TRAFFIC
// ==========================================
export type VesselType =
  | 'tanker'
  | 'oil_chemical_tanker'
  | 'lpg_lng_carrier'
  | 'bulk_carrier'
  | 'container'
  | 'cargo'
  | 'tug'
  | 'fishing'
  | 'passenger'
  | 'military'
  | 'unknown';

export type NavigationalStatus =
  | 'Under way using engine'
  | 'At anchor'
  | 'Not under command'
  | 'Restricted manoeuvrability'
  | 'Constrained by draft'
  | 'Moored'
  | 'Aground'
  | 'Engaged in fishing'
  | 'Under way sailing'
  | 'Undefined';

export interface AISRecord {
  id: string;
  mmsi: string;
  timestamp: string; // ISO UTC
  lat: number;
  lng: number;
  speedKnots: number;
  headingDegrees: number;
  courseOverGround?: number;
  navigationalStatus?: NavigationalStatus;
  rateOfTurn?: number;
  provenance: DataProvenance; // OBSERVED
}

export interface VesselTrack {
  mmsi: string;
  vesselName: string;
  startTime: string;
  endTime: string;
  pointsCount: number;
  records: AISRecord[];
  coordinates: [number, number][]; // [lat, lng] array
  minSpeedKnots: number;
  maxSpeedKnots: number;
  avgSpeedKnots: number;
  provenance: DataProvenance;
}

export interface Vessel {
  id: string;
  name: string;
  mmsi: string;
  imo?: string;
  callsign?: string;
  flag: string;
  flagCountry: string;
  type: VesselType;
  lengthMeters: number;
  widthMeters: number;
  draftMeters: number;
  grossTonnage?: number;
  deadweightTonnage?: number;
  builtYear?: number;
  currentPosition?: LatLng;
  currentSpeedKnots?: number;
  currentHeadingDegrees?: number;
  destination?: string;
  eta?: string;
  lastPort?: string;
  track?: VesselTrack;
  provenance: DataProvenance;
}

// ==========================================
// 6. DRIFT, HINDCAST & ORIGIN ESTIMATE
// ==========================================
export interface OceanCurrentVector {
  uMs: number; // Eastward velocity m/s
  vMs: number; // Northward velocity m/s
  speedKnots: number;
  directionDegrees: number;
  depthMeters: number;
  provenance: DataProvenance; // OBSERVED / DERIVED from CMEMS / Copernicus Reanalysis
}

export interface WindVector {
  uMs: number;
  vMs: number;
  speedKnots: number;
  directionDegrees: number;
  provenance: DataProvenance; // OBSERVED / ERA5 reanalysis
}

export interface OriginEstimate {
  id: string;
  spillId: string;
  estimatedTimeWindow: {
    earliest: string;
    mostProbable: string;
    latest: string;
  };
  probableOriginLocation: LatLng;
  uncertaintyRadiusKm: number;
  hindcastModel: string; // e.g. "CMEMS Currents + ERA5 Leeway Drift 3.5%"
  modelParameters: {
    windLeewayFactor: number; // typically 0.03 - 0.04
    windDeflectionAngleDegrees: number; // typically 0° to 25° right in Northern Hemisphere
    currentCorrection: number;
  };
  provenance: DataProvenance; // ESTIMATED / DERIVED
}

export interface DriftPrediction {
  id: string;
  spillId: string;
  trajectoryType: 'HINDCAST' | 'FORECAST';
  generatedAt: string;
  steps: {
    timestamp: string;
    lat: number;
    lng: number;
    currentVector: OceanCurrentVector;
    windVector: WindVector;
    uncertaintyRadiusKm: number;
  }[];
  provenance: DataProvenance; // DERIVED / ESTIMATED
}

// ==========================================
// 7. CORRELATION, EVIDENCE & ATTRIBUTION
// ==========================================
export interface EvidenceItem {
  id: string;
  category: 'SPATIO_TEMPORAL' | 'BEHAVIORAL_ANOMALY' | 'HYDROCARBON_TYPE' | 'COLLISION_RECORD' | 'RADAR_SIGNATURE';
  title: string;
  description: string;
  confidenceWeight: number; // 0 - 100
  provenance: DataProvenance;
  timestamp?: string;
  associatedData?: Record<string, unknown>;
}

export interface AttributionCandidate {
  rank: number;
  vessel: Vessel;
  overallScore: number; // 0 - 100%
  spatioTemporalScore: number; // 0 - 100%
  behavioralAnomalyScore: number; // 0 - 100%
  vesselTypeRiskScore: number; // 0 - 100%
  closestApproachDistanceKm: number;
  closestApproachTimestamp: string;
  closestApproachLocation: LatLng;
  distanceToEstimatedOriginKm: number;
  speedAnomalyDetected: boolean;
  speedDropKnots?: number;
  courseAnomalyDegrees?: number;
  aisBlackoutDurationMinutes?: number;
  evidence: EvidenceItem[];
  provenance: DataProvenance; // DERIVED / ESTIMATED
}

export interface AttributionResult {
  spillId: string;
  primarySuspect: AttributionCandidate;
  candidates: AttributionCandidate[];
  overallAttributionConfidence: number; // 0-100%
  scientificSummary: string;
  legalConclusion: string;
  completedAt: string;
  provenance: DataProvenance;
}

// ==========================================
// 8. INVESTIGATION & WORKFLOW
// ==========================================
export type WorkflowStageKey =
  | 'SATELLITE_OBSERVATION'
  | 'OIL_SLICK_DETECTION'
  | 'SLICK_CHARACTERIZATION'
  | 'ORIGIN_HINDCAST'
  | 'AIS_TRAFFIC_RECONSTRUCTION'
  | 'CANDIDATE_VESSELS'
  | 'SPATIO_TEMPORAL_CORRELATION'
  | 'VESSEL_ATTRIBUTION'
  | 'INVESTIGATION_REPORT';

export interface WorkflowPhase {
  key: WorkflowStageKey;
  label: string;
  order: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FLAGGED';
  startedAt?: string;
  completedAt?: string;
  analystNotes?: string;
  keyFindings?: string[];
  provenance: DataProvenance;
}

export interface Investigation {
  id: string;
  caseNumber: string; // e.g. "INV-2017-ENN-001"
  title: string;
  spillId: string;
  spill: OilSpill;
  leadInvestigator: string;
  status: SpillStatus;
  currentStage: WorkflowStageKey;
  phases: Record<WorkflowStageKey, WorkflowPhase>;
  originEstimate?: OriginEstimate;
  driftPredictions: DriftPrediction[];
  attributionResult?: AttributionResult;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

// ==========================================
// 9. REPORT
// ==========================================
export type ReportClassification = 'CONFIDENTIAL_LEGAL' | 'MARITIME_AUTHORITY' | 'PUBLIC_COMMUNIQUE' | 'INSURANCE_BRIEF';

export interface InvestigationReport {
  id: string;
  investigationId: string;
  caseNumber: string;
  title: string;
  generatedAt: string;
  author: string;
  authority: string; // e.g. "Indian Coast Guard / DG Shipping / National Spill Response Centre"
  classification: ReportClassification;
  executiveSummary: string;
  satelliteFindings: {
    sceneId: string;
    satellite: string;
    detectionTime: string;
    slickAreaKm2: number;
    slickCoordinates: string;
    sensorMode: string;
  };
  hindcastAnalysis: {
    modelUsed: string;
    calculatedOriginTime: string;
    calculatedOriginCoords: string;
    oceanCurrentSummary: string;
    windVectorSummary: string;
  };
  vesselAttribution: {
    primaryVesselName: string;
    mmsi: string;
    imo: string;
    flag: string;
    attributionConfidencePercent: number;
    keyViolations: string[];
    evidenceCount: number;
  };
  evidentiaryChain: EvidenceItem[];
  concludingRemarks: string;
  signoff: {
    officerName: string;
    rank: string;
    date: string;
  };
}

// Alias for Report interface requested in prompt
export type Report = InvestigationReport;

// ==========================================
// 10. SYSTEM METRICS & ANALYTICS
// ==========================================
export interface SystemStatus {
  activeAISFeedCount: number;
  connectedSatellitesCount: number;
  totalSpillsTracked: number;
  activeInvestigations: number;
  attributedCases: number;
  lastAISPacketReceivedAt: string;
  lastSatellitePassAt: string;
  systemUptimePercent: number;
  dataPipelineLatencySec: number;
}

export interface AnalyticsSummary {
  detectionsByMonth: { month: string; count: number; volumeM3: number }[];
  sizeDistribution: { category: string; count: number; percentage: number }[];
  attributionConfidenceBuckets: { range: string; count: number }[];
  vesselTypeInvolvement: { type: string; count: number; percentage: number }[];
  seaAreaHeatmap: { region: string; spillCount: number; avgAttributionRate: number }[];
}

// ==========================================
// 11. PRIMARY NAVIGATION & APP STATE
// ==========================================
export type PrimarySection = 'dashboard' | 'reports' | 'analytics' | 'settings';

export interface AppStateFilter {
  searchQuery: string;
  status: SpillStatus | 'all';
  region: string;
  dateRange: {
    from?: string;
    to?: string;
  };
  selectedSpillId: string | null;
  selectedInvestigationId: string | null;
}
