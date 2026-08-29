export interface AppSettings {
  // Map preferences
  mapTileLayer: 'dark_matter' | 'voyager' | 'satellite';
  defaultSarOverlay: boolean;
  defaultSarOpacity: number;
  showHindcastVectors: boolean;
  showAisTracks: boolean;
  showSlickCentroid: boolean;

  // Attribution multi-factor weights
  spatioTemporalWeight: number; // 10 - 70
  speedAnomalyWeight: number; // 10 - 70
  vesselTypeWeight: number; // 5 - 50

  // Statutory limits
  minConfidenceThreshold: number; // 50 - 95
  sarResolutionLimitMeters: number; // 5 - 50

  // System & Link
  dataMode: 'demo' | 'api';
  apiBaseUrl: string;
  refreshIntervalSeconds: number;
  reducedMotion: boolean;
}

const STORAGE_KEY = 'marine_spill_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  mapTileLayer: 'dark_matter',
  defaultSarOverlay: true,
  defaultSarOpacity: 0.8,
  showHindcastVectors: true,
  showAisTracks: true,
  showSlickCentroid: true,

  spatioTemporalWeight: 45,
  speedAnomalyWeight: 35,
  vesselTypeWeight: 20,

  minConfidenceThreshold: 70,
  sarResolutionLimitMeters: 10,

  dataMode: 'demo',
  apiBaseUrl: 'http://localhost:8000/api/v1',
  refreshIntervalSeconds: 30,
  reducedMotion: false,
};

export function getStoredSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load settings from localStorage', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings to localStorage', e);
  }
}
