import type {
  OilSpill,
  Investigation,
  Vessel,
  VesselTrack,
  InvestigationReport,
  AnalyticsSummary,
  SystemStatus,
  AppStateFilter,
} from '../../types';

export interface IDataProvider {
  getSpills(filter?: Partial<AppStateFilter>): Promise<OilSpill[]>;
  getSpillById(id: string): Promise<OilSpill | null>;
  getInvestigations(): Promise<Investigation[]>;
  getInvestigationById(id: string): Promise<Investigation | null>;
  getInvestigationBySpillId(spillId: string): Promise<Investigation | null>;
  getVessels(): Promise<Vessel[]>;
  getVesselByMmsi(mmsi: string): Promise<Vessel | null>;
  getVesselTracks(): Promise<VesselTrack[]>;
  getReports(): Promise<InvestigationReport[]>;
  getReportById(id: string): Promise<InvestigationReport | null>;
  getAnalyticsSummary(): Promise<AnalyticsSummary>;
  getSystemStatus(): Promise<SystemStatus>;
}
