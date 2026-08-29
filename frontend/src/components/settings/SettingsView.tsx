import { useState, useEffect } from 'react';
import { Settings, Database, Sliders, ShieldCheck, Map } from 'lucide-react';
import { ProvenanceTag } from '../ui/Badge';
import { getStoredSettings, saveSettings, type AppSettings, DEFAULT_SETTINGS } from '../../data/settingsStore';

export function SettingsView() {
  const [settings, setSettings] = useState<AppSettings>(getStoredSettings());
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setSettings(getStoredSettings());
  }, []);

  const handleSave = () => {
    saveSettings(settings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all ground station parameters to system defaults?')) {
      setSettings(DEFAULT_SETTINGS);
      saveSettings(DEFAULT_SETTINGS);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  const totalWeight =
    settings.spatioTemporalWeight + settings.speedAnomalyWeight + settings.vesselTypeWeight;

  return (
    <div className="h-full w-full bg-[#080C0B] p-3 overflow-y-auto space-y-3 font-sans text-xs max-w-5xl mx-auto select-none">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#111716] p-3 rounded-xs border border-[#29332F]">
        <div>
          <div className="flex items-center gap-2 font-mono font-bold text-xs text-[#E8EFEC]">
            <Settings className="w-4 h-4 text-[#5EE6C0]" />
            <span>GROUND STATION PARAMETERS & SENSOR CALIBRATION</span>
          </div>
          <p className="text-[#68746F] font-mono text-[10px] mt-0.5">
            SIH Problem Statement 26143 &bull; Sensor Pipelines & Multi-Factor Correlation Tuner
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px]">
          {savedSuccess && (
            <span className="text-[#5EE6C0] bg-[#236B5B]/30 px-2 py-0.5 rounded-xs border border-[#38B99A]/50 font-bold">
              ✓ PARAMETERS SAVED
            </span>
          )}
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-2.5 py-1.5 bg-[#161D1B] hover:bg-[#1C2522] border border-[#29332F] text-[#A5B1AC] font-bold rounded-xs cursor-pointer transition-colors"
          >
            RESET DEFAULTS
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 bg-[#236B5B] hover:bg-[#38B99A] text-slate-950 font-bold rounded-xs cursor-pointer shadow-xs transition-colors"
          >
            SAVE CONFIGURATION
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* 1. Data Adapter Provider Mode */}
        <div className="bg-[#111716] p-3 rounded-xs border border-[#29332F] space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#202925] pb-1.5">
            <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-[#E8EFEC]">
              <Database className="w-3.5 h-3.5 text-[#5EE6C0]" />
              <span>DATA ADAPTER INGESTION SOURCE</span>
            </div>
            <ProvenanceTag provenance={settings.dataMode === 'demo' ? 'SIMULATED' : 'OBSERVED'} />
          </div>

          <div className="space-y-2 text-[#A5B1AC] font-mono text-[10px]">
            <label className="block text-[#E8EFEC] font-bold">ACTIVE DATA PROVIDER:</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, dataMode: 'demo' }))}
                className={`p-2 rounded-xs border text-left cursor-pointer transition-all ${
                  settings.dataMode === 'demo'
                    ? 'bg-[#161D1B] border-[#5EE6C0]/70 text-[#5EE6C0] font-bold'
                    : 'bg-[#0E1413] border-[#202925] text-[#68746F] hover:text-[#A5B1AC]'
                }`}
              >
                <div className="text-[11px]">DEMO / ENNORE CASE</div>
                <div className="text-[8px] text-[#68746F] font-normal mt-0.5">
                  Real S1A SAR & 50-Vessel AIS
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, dataMode: 'api' }))}
                className={`p-2 rounded-xs border text-left cursor-pointer transition-all ${
                  settings.dataMode === 'api'
                    ? 'bg-[#161D1B] border-[#5EE6C0]/70 text-[#5EE6C0] font-bold'
                    : 'bg-[#0E1413] border-[#202925] text-[#68746F] hover:text-[#A5B1AC]'
                }`}
              >
                <div className="text-[11px]">LIVE REST API</div>
                <div className="text-[8px] text-[#68746F] font-normal mt-0.5">
                  Production REST endpoints
                </div>
              </button>
            </div>

            <div className="pt-1.5 space-y-1">
              <label className="text-[9px] text-[#68746F] uppercase">REST API ENDPOINT BASE URL</label>
              <input
                type="text"
                value={settings.apiBaseUrl}
                onChange={(e) => setSettings((s) => ({ ...s, apiBaseUrl: e.target.value }))}
                disabled={settings.dataMode === 'demo'}
                className="w-full px-2.5 py-1 bg-[#161D1B] border border-[#202925] rounded-xs text-[#E8EFEC] font-mono disabled:opacity-50 text-[10px] focus:outline-none focus:border-[#5EE6C0]/50"
              />
            </div>
          </div>
        </div>

        {/* 2. Map & Geospatial Layer Preferences */}
        <div className="bg-[#111716] p-3 rounded-xs border border-[#29332F] space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#202925] pb-1.5">
            <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-[#E8EFEC]">
              <Map className="w-3.5 h-3.5 text-[#5EE6C0]" />
              <span>GEOSPATIAL DISPLAY PREFERENCES</span>
            </div>
            <span className="text-[9px] font-mono text-[#5EE6C0]">DARK RASTER</span>
          </div>

          <div className="space-y-2 font-mono text-[10px] text-[#A5B1AC]">
            <div className="flex items-center justify-between">
              <span>DEFAULT SAR OVERLAY OPACITY:</span>
              <span className="font-bold text-[#E8EFEC]">{(settings.defaultSarOpacity * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={settings.defaultSarOpacity}
              onChange={(e) => setSettings((s) => ({ ...s, defaultSarOpacity: parseFloat(e.target.value) }))}
              className="w-full accent-[#5EE6C0]"
            />

            <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-[#202925] text-[9px]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showHindcastVectors}
                  onChange={(e) => setSettings((s) => ({ ...s, showHindcastVectors: e.target.checked }))}
                  className="rounded-xs text-[#5EE6C0] accent-[#5EE6C0]"
                />
                <span>Show Hindcast Vectors</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showAisTracks}
                  onChange={(e) => setSettings((s) => ({ ...s, showAisTracks: e.target.checked }))}
                  className="rounded-xs text-[#5EE6C0] accent-[#5EE6C0]"
                />
                <span>Show AIS Tracks</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showSlickCentroid}
                  onChange={(e) => setSettings((s) => ({ ...s, showSlickCentroid: e.target.checked }))}
                  className="rounded-xs text-[#5EE6C0] accent-[#5EE6C0]"
                />
                <span>Show Centroid Node</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.reducedMotion}
                  onChange={(e) => setSettings((s) => ({ ...s, reducedMotion: e.target.checked }))}
                  className="rounded-xs text-[#5EE6C0] accent-[#5EE6C0]"
                />
                <span>Reduced Motion</span>
              </label>
            </div>
          </div>
        </div>

        {/* 3. AIS Attribution Multi-Factor Weights */}
        <div className="bg-[#111716] p-3 rounded-xs border border-[#29332F] space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#202925] pb-1.5">
            <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-[#E8EFEC]">
              <Sliders className="w-3.5 h-3.5 text-[#5EE6C0]" />
              <span>ATTRIBUTION MODEL FACTOR WEIGHTS</span>
            </div>
            <span className={`font-mono text-[9px] font-bold ${totalWeight === 100 ? 'text-[#5EE6C0]' : 'text-[#E8A84E]'}`}>
              SUM: {totalWeight}% {totalWeight !== 100 && '(Normalized)'}
            </span>
          </div>

          <div className="space-y-2 font-mono text-[10px] text-[#A5B1AC]">
            <div>
              <div className="flex justify-between mb-0.5">
                <span>SPATIO-TEMPORAL PROXIMITY WEIGHT:</span>
                <span className="font-bold text-[#5EE6C0]">{settings.spatioTemporalWeight}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="70"
                value={settings.spatioTemporalWeight}
                onChange={(e) => setSettings((s) => ({ ...s, spatioTemporalWeight: parseInt(e.target.value) }))}
                className="w-full accent-[#5EE6C0]"
              />
            </div>

            <div>
              <div className="flex justify-between mb-0.5">
                <span>KINEMATIC DECELERATION DROP WEIGHT:</span>
                <span className="font-bold text-[#F05D5E]">{settings.speedAnomalyWeight}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="70"
                value={settings.speedAnomalyWeight}
                onChange={(e) => setSettings((s) => ({ ...s, speedAnomalyWeight: parseInt(e.target.value) }))}
                className="w-full accent-[#5EE6C0]"
              />
            </div>

            <div>
              <div className="flex justify-between mb-0.5">
                <span>VESSEL CARGO & RISK PROFILE WEIGHT:</span>
                <span className="font-bold text-[#E8A84E]">{settings.vesselTypeWeight}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                value={settings.vesselTypeWeight}
                onChange={(e) => setSettings((s) => ({ ...s, vesselTypeWeight: parseInt(e.target.value) }))}
                className="w-full accent-[#5EE6C0]"
              />
            </div>
          </div>
        </div>

        {/* 4. Statutory Thresholds */}
        <div className="bg-[#111716] p-3 rounded-xs border border-[#29332F] space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#202925] pb-1.5">
            <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-[#E8EFEC]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#5EE6C0]" />
              <span>STATUTORY LEGAL ACTION THRESHOLDS</span>
            </div>
          </div>

          <div className="space-y-2.5 font-mono text-[10px] text-[#A5B1AC]">
            <div>
              <div className="flex justify-between mb-0.5">
                <span>MINIMUM CERTAINTY FOR STATUTORY ACTION:</span>
                <span className="font-bold text-[#5EE6C0]">{settings.minConfidenceThreshold}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                value={settings.minConfidenceThreshold}
                onChange={(e) => setSettings((s) => ({ ...s, minConfidenceThreshold: parseInt(e.target.value) }))}
                className="w-full accent-[#5EE6C0]"
              />
            </div>

            <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925] text-[9px] space-y-1">
              <span className="font-bold text-[#E8EFEC] block">LEGAL FRAMEWORK & DIRECTIVES:</span>
              <p className="text-[#68746F]">
                Merchant Shipping Act 1958 Part XI-A &bull; MARPOL 73/78 Annex I &bull; Indian Coast Guard Directive 2026/S-1
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
