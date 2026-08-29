import { useState } from 'react';
import type { SatelliteObservation } from '../../types';
import { ProvenanceTag } from '../ui/Badge';
import { X, ZoomIn, ZoomOut, Satellite, Crosshair } from 'lucide-react';

interface SatelliteAnalysisModalProps {
  observation: SatelliteObservation;
  isOpen: boolean;
  onClose: () => void;
}

export function SatelliteAnalysisModal({
  observation,
  isOpen,
  onClose,
}: SatelliteAnalysisModalProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(120);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="bg-[#0B0F0E] border border-[#29332F] rounded-xs w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Top Header */}
        <div className="p-3 border-b border-[#29332F] bg-[#111716] flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono">
            <Satellite className="w-4 h-4 text-[#5EE6C0]" />
            <div>
              <div className="font-bold text-xs text-[#E8EFEC] flex items-center gap-2">
                <span>SAR GRANULE INSPECTION // {observation.platform}</span>
                <ProvenanceTag provenance="OBSERVED" />
              </div>
              <span className="text-[10px] text-[#68746F]">{observation.rawGranuleId}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-xs bg-[#161D1B] border border-[#29332F] text-[#A5B1AC] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Center Viewer Area */}
        <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center p-4 min-h-[380px]">
          {observation.quicklookUrl ? (
            <div className="relative overflow-hidden border border-[#202925] rounded-xs flex items-center justify-center">
              <img
                src={observation.quicklookUrl}
                alt="Sentinel-1 SAR Scene"
                style={{
                  transform: `scale(${zoomLevel})`,
                  filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                  transition: 'transform 0.1s ease',
                }}
                className="max-h-[60vh] max-w-full object-contain cursor-grab"
              />
              {/* Radar Crosshair Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-20">
                <Crosshair className="w-24 h-24 text-[#5EE6C0]" />
              </div>
            </div>
          ) : (
            <div className="text-[#68746F] font-mono text-xs">NO SAR IMAGE LOADED</div>
          )}

          {/* Floating Controls HUD */}
          <div className="absolute bottom-4 left-4 bg-[#111716]/90 border border-[#29332F] rounded-xs p-2 flex items-center gap-3 font-mono text-[10px] text-[#A5B1AC] backdrop-blur-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                className="w-6 h-6 rounded-xs bg-[#161D1B] border border-[#29332F] flex items-center justify-center hover:text-white cursor-pointer"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="w-10 text-center text-[#E8EFEC] font-bold">{(zoomLevel * 100).toFixed(0)}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                className="w-6 h-6 rounded-xs bg-[#161D1B] border border-[#29332F] flex items-center justify-center hover:text-white cursor-pointer"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 border-l border-[#29332F] pl-3">
              <span>CONTRAST:</span>
              <input
                type="range"
                min="50"
                max="200"
                value={contrast}
                onChange={(e) => setContrast(parseInt(e.target.value))}
                className="w-16 accent-[#5EE6C0]"
              />
            </div>

            <div className="flex items-center gap-1.5 border-l border-[#29332F] pl-3">
              <span>BRIGHTNESS:</span>
              <input
                type="range"
                min="50"
                max="200"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value))}
                className="w-16 accent-[#5EE6C0]"
              />
            </div>
          </div>
        </div>

        {/* Modal Bottom Metadata Matrix */}
        <div className="p-3 bg-[#111716] border-t border-[#29332F] font-mono text-[10px] grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <span className="text-[#68746F] block">PASS ACQUISITION:</span>
            <span className="font-bold text-[#E8EFEC]">
              {new Date(observation.acquisitionTime).toUTCString()}
            </span>
          </div>
          <div>
            <span className="text-[#68746F] block">POLARIZATION / MODE:</span>
            <span className="font-bold text-[#5EE6C0]">
              {observation.polarization} &bull; {observation.mode}
            </span>
          </div>
          <div>
            <span className="text-[#68746F] block">SPATIAL RESOLUTION:</span>
            <span className="font-bold text-[#E8EFEC]">{observation.resolutionMeters}m GRD Level-1</span>
          </div>
          <div>
            <span className="text-[#68746F] block">DARK PATCH CONTRAST:</span>
            <span className="font-bold text-[#5EE6C0]">{observation.darkPatchContrastDb} dB Anomaly</span>
          </div>
        </div>
      </div>
    </div>
  );
}
