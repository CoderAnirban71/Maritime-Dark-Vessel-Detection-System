import type { OilSpill } from '../../types';
import { ProvenanceTag } from '../ui/Badge';
import { Sliders, MapPin, Satellite } from 'lucide-react';

interface SlickAnalysisCardProps {
  spill: OilSpill | null;
  onOpenSarInspector?: () => void;
}

export function SlickAnalysisCard({ spill, onOpenSarInspector }: SlickAnalysisCardProps) {
  if (!spill) {
    return (
      <div className="bg-[#111716] rounded-xs border border-[#202925] p-3 text-center font-mono text-[10px] text-[#68746F]">
        NO SLICK LOADED
      </div>
    );
  }

  const { geometry, satelliteObservation: sat } = spill;

  return (
    <div className="bg-[#111716] rounded-xs border border-[#29332F] p-3 space-y-2.5 font-sans text-xs select-none">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-[#202925] pb-2">
        <div className="flex items-center gap-1.5 font-mono">
          <Sliders className="w-3.5 h-3.5 text-[#5EE6C0]" />
          <span className="font-bold text-xs text-[#E8EFEC]">SLICK MORPHOMETRICS</span>
        </div>
        <ProvenanceTag provenance="DERIVED" />
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
        <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
          <span className="text-[#68746F] block uppercase">SURFACE AREA</span>
          <span className="text-sm font-bold text-[#E8EFEC]">{geometry.areaKm2} km²</span>
        </div>
        <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
          <span className="text-[#68746F] block uppercase">EST. VOLUME</span>
          <span className="text-sm font-bold text-[#E8EFEC]">~{spill.estimatedVolumeM3 || 'N/A'} m³</span>
        </div>
        <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
          <span className="text-[#68746F] block uppercase">LENGTH × WIDTH</span>
          <span className="font-bold text-[#A5B1AC]">{geometry.lengthKm} km × {geometry.widthKm} km</span>
        </div>
        <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
          <span className="text-[#68746F] block uppercase">WEATHERING AGE</span>
          <span className="font-bold text-[#D5B76A]">~{spill.estimatedAgeHours} hrs</span>
        </div>
      </div>

      {/* Geographic Centroid */}
      <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925] font-mono text-[10px] space-y-1">
        <div className="flex items-center justify-between text-[#68746F]">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#38B99A]" />
            SLICK CENTROID
          </span>
          <span className="text-[#5EE6C0] font-bold">
            {geometry.center.lat.toFixed(4)}°N, {geometry.center.lng.toFixed(4)}°E
          </span>
        </div>
        <div className="flex items-center justify-between text-[#68746F]">
          <span>DISTANCE TO COAST:</span>
          <span className="text-[#E8EFEC] font-bold">{spill.location.distanceToCoastKm} km</span>
        </div>
      </div>

      {/* SAR Acquisition Sensor Parameters */}
      <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925] font-mono text-[10px] space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#E8EFEC] flex items-center gap-1">
            <Satellite className="w-3 h-3 text-[#5EE6C0]" />
            SAR BACKSCATTER SIGNATURE
          </span>
          {onOpenSarInspector && (
            <button
              type="button"
              onClick={onOpenSarInspector}
              className="text-[9px] text-[#5EE6C0] underline hover:text-[#E8EFEC] cursor-pointer"
            >
              INSPECT GRANULE
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1 text-[9px]">
          <div>
            <span className="text-[#68746F]">POLARIZATION:</span>{' '}
            <span className="text-[#E8EFEC] font-bold">{sat.polarization}</span>
          </div>
          <div>
            <span className="text-[#68746F]">ATTENUATION:</span>{' '}
            <span className="text-[#5EE6C0] font-bold">{sat.darkPatchContrastDb} dB</span>
          </div>
          <div>
            <span className="text-[#68746F]">INCIDENCE:</span>{' '}
            <span className="text-[#A5B1AC]">{sat.incidenceAngleRange[0]}° - {sat.incidenceAngleRange[1]}°</span>
          </div>
          <div>
            <span className="text-[#68746F]">WIND:</span>{' '}
            <span className="text-[#A5B1AC]">{sat.windSpeedAtAcquisitionKnots || 8.2} kts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
