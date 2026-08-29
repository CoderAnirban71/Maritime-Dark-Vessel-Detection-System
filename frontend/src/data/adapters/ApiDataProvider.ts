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

export class ApiDataProvider implements IDataProvider {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || import.meta.env.VITE_API_URL || '/api/v1';
  }

  private async fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!res.ok) {
      throw new Error(`API Error [${res.status}]: ${res.statusText}`);
    }

    return res.json();
  }

  async getSpills(filter?: Partial<AppStateFilter>): Promise<OilSpill[]> {
    const params = new URLSearchParams();
    if (filter?.status && filter.status !== 'all') params.set('status', filter.status);
    if (filter?.searchQuery) params.set('q', filter.searchQuery);
    return this.fetchJson<OilSpill[]>(`/spills?${params.toString()}`);
  }

  async getSpillById(id: string): Promise<OilSpill | null> {
    return this.fetchJson<OilSpill>(`/spills/${id}`).catch(() => null);
  }

  async getInvestigations(): Promise<Investigation[]> {
    return this.fetchJson<Investigation[]>('/investigations');
  }

  async getInvestigationById(id: string): Promise<Investigation | null> {
    return this.fetchJson<Investigation>(`/investigations/${id}`).catch(() => null);
  }

  async getInvestigationBySpillId(spillId: string): Promise<Investigation | null> {
    return this.fetchJson<Investigation>(`/investigations/spill/${spillId}`).catch(() => null);
  }

  async getVessels(): Promise<Vessel[]> {
    return this.fetchJson<Vessel[]>('/vessels');
  }

  async getVesselByMmsi(mmsi: string): Promise<Vessel | null> {
    return this.fetchJson<Vessel>(`/vessels/${mmsi}`).catch(() => null);
  }

  async getVesselTracks(): Promise<VesselTrack[]> {
    return this.fetchJson<VesselTrack[]>('/ais/tracks');
  }

  async getReports(): Promise<InvestigationReport[]> {
    return this.fetchJson<InvestigationReport[]>('/reports');
  }

  async getReportById(id: string): Promise<InvestigationReport | null> {
    return this.fetchJson<InvestigationReport>(`/reports/${id}`).catch(() => null);
  }

  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    return this.fetchJson<AnalyticsSummary>('/analytics/summary');
  }

  async getSystemStatus(): Promise<SystemStatus> {
    return this.fetchJson<SystemStatus>('/system/status');
  }
}
