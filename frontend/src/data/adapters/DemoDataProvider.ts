import type { IDataProvider } from './DataProvider';
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
import {
  demoSpills,
  demoInvestigations,
  demoVessels,
  demoReports,
  demoAnalyticsSummary,
  demoSystemStatus,
} from '../demo';

export class DemoDataProvider implements IDataProvider {
  async getSpills(filter?: Partial<AppStateFilter>): Promise<OilSpill[]> {
    let result = [...demoSpills];

    if (filter?.status && filter.status !== 'all') {
      result = result.filter((s) => s.status === filter.status);
    }

    if (filter?.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.location.seaArea.toLowerCase().includes(q) ||
          s.satelliteObservation.platform.toLowerCase().includes(q)
      );
    }

    return result;
  }

  async getSpillById(id: string): Promise<OilSpill | null> {
    return demoSpills.find((s) => s.id === id) || null;
  }

  async getInvestigations(): Promise<Investigation[]> {
    return [...demoInvestigations];
  }

  async getInvestigationById(id: string): Promise<Investigation | null> {
    return demoInvestigations.find((inv) => inv.id === id) || null;
  }

  async getInvestigationBySpillId(spillId: string): Promise<Investigation | null> {
    return demoInvestigations.find((inv) => inv.spillId === spillId) || null;
  }

  async getVessels(): Promise<Vessel[]> {
    return [...demoVessels];
  }

  async getVesselByMmsi(mmsi: string): Promise<Vessel | null> {
    return demoVessels.find((v) => v.mmsi === mmsi) || null;
  }

  async getVesselTracks(): Promise<VesselTrack[]> {
    return demoVessels.map((v) => v.track).filter((t): t is VesselTrack => Boolean(t));
  }

  async getReports(): Promise<InvestigationReport[]> {
    return [...demoReports];
  }

  async getReportById(id: string): Promise<InvestigationReport | null> {
    return demoReports.find((r) => r.id === id) || null;
  }

  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    return { ...demoAnalyticsSummary };
  }

  async getSystemStatus(): Promise<SystemStatus> {
    return { ...demoSystemStatus };
  }
}
