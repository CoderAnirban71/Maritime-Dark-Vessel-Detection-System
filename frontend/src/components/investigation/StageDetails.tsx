import type { Investigation, WorkflowStageKey } from '../../types';
import { ProvenanceTag } from '../ui/Badge';
import { CheckCircle2, Clock, FileCheck } from 'lucide-react';

interface StageDetailsProps {
  investigation: Investigation;
  activeStage: WorkflowStageKey;
  onNavigateToReports?: () => void;
}

export function StageDetails({
  investigation,
  activeStage,
  onNavigateToReports,
}: StageDetailsProps) {
  const phase = investigation.phases[activeStage];
  const { spill, originEstimate, attributionResult } = investigation;
  const sat = spill.satelliteObservation;

  return (
    <div className="bg-[#111716] rounded-xs border border-[#29332F] p-3 flex flex-col h-full overflow-y-auto space-y-3 font-sans text-xs">
      {/* 1. Technical Stage Header */}
      <div className="flex items-start justify-between border-b border-[#202925] pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs uppercase tracking-wider text-[#E8EFEC]">
              {phase.label}
            </span>
            <ProvenanceTag provenance={phase.provenance} />
          </div>
          <p className="text-[#68746F] font-mono text-[10px] mt-0.5">
            STAGE [0{phase.order}/09] • STATUS: <span className="font-semibold text-[#5EE6C0]">{phase.status}</span>
          </p>
        </div>
        {phase.completedAt && (
          <div className="flex items-center gap-1 text-[#68746F] font-mono text-[10px]">
            <Clock className="w-3 h-3 text-[#38B99A]" />
            <span>{new Date(phase.completedAt).toISOString().replace('T', ' ').replace('Z', '')} UTC</span>
          </div>
        )}
      </div>

      {/* 2. Dynamic Content Per Stage */}
      {activeStage === 'SATELLITE_OBSERVATION' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
            <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
              <span className="text-[#68746F] block uppercase">PLATFORM / SENSOR</span>
              <span className="text-[#E8EFEC] font-bold">{sat.platform} • {sat.sensor}</span>
            </div>
            <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
              <span className="text-[#68746F] block uppercase">POLARIZATION / MODE</span>
              <span className="text-[#E8EFEC] font-bold">{sat.polarization} • {sat.mode}</span>
            </div>
            <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
              <span className="text-[#68746F] block uppercase">ORBIT PASS</span>
              <span className="text-[#E8EFEC] font-bold">{sat.orbitPass} (REL #{sat.relativeOrbit})</span>
            </div>
            <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
              <span className="text-[#68746F] block uppercase">RES / CONTRAST</span>
              <span className="text-[#5EE6C0] font-bold">{sat.resolutionMeters}m • {sat.darkPatchContrastDb} dB</span>
            </div>
          </div>

          {sat.quicklookUrl && (
            <div className="rounded-xs overflow-hidden border border-[#29332F]">
              <div className="bg-[#080C0B] text-[#A5B1AC] text-[9px] px-2 py-1 font-mono flex justify-between border-b border-[#202925]">
                <span className="truncate">SAR GRANULE: {sat.rawGranuleId}</span>
                <ProvenanceTag provenance="OBSERVED" />
              </div>
              <img
                src={sat.quicklookUrl}
                alt="SAR Quicklook"
                className="w-full h-36 object-cover bg-black"
              />
            </div>
          )}
        </div>
      )}

      {activeStage === 'OIL_SLICK_DETECTION' && (
        <div className="space-y-2.5">
          <div className="p-2.5 bg-[#161D1B] rounded-xs border border-[#29332F] space-y-1">
            <div className="font-mono font-bold text-xs text-[#5EE6C0] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#5EE6C0]" />
              SAR C-BAND RADAR ATTENUATION
            </div>
            <p className="text-[#A5B1AC] text-[11px] leading-relaxed">
              Capillary surface damping validated. Negative backscatter contrast of <span className="font-mono font-bold text-[#E8EFEC]">{sat.darkPatchContrastDb} dB</span> confirms high-viscosity mineral oil slick.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 font-mono text-center text-[10px]">
            <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
              <div className="text-[#68746F]">CONFIDENCE</div>
              <div className="text-xs font-bold text-[#5EE6C0]">{spill.confidenceScore}%</div>
            </div>
            <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
              <div className="text-[#68746F]">ATTENUATION</div>
              <div className="text-xs font-bold text-[#E8EFEC]">{sat.darkPatchContrastDb} dB</div>
            </div>
            <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
              <div className="text-[#68746F]">WIND SPEED</div>
              <div className="text-xs font-bold text-[#E8EFEC]">{sat.windSpeedAtAcquisitionKnots} kts</div>
            </div>
          </div>
        </div>
      )}

      {activeStage === 'SLICK_CHARACTERIZATION' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
            <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
              <span className="text-[#68746F] block uppercase">SURFACE AREA</span>
              <span className="text-sm font-bold text-[#E8EFEC]">{spill.geometry.areaKm2} km²</span>
            </div>
            <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
              <span className="text-[#68746F] block uppercase">EST. VOLUME</span>
              <span className="text-sm font-bold text-[#E8EFEC]">~{spill.estimatedVolumeM3} m³</span>
            </div>
            <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
              <span className="text-[#68746F] block uppercase">DIMENSIONS</span>
              <span className="text-[#A5B1AC] font-bold">{spill.geometry.lengthKm} km × {spill.geometry.widthKm} km</span>
            </div>
            <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
              <span className="text-[#68746F] block uppercase">WEATHERING AGE</span>
              <span className="text-[#A5B1AC] font-bold">~{spill.estimatedAgeHours} hrs</span>
            </div>
          </div>
        </div>
      )}

      {activeStage === 'ORIGIN_HINDCAST' && originEstimate && (
        <div className="space-y-2.5 font-mono text-[10px]">
          <div className="p-2 bg-[#1C2522] rounded-xs border border-[#E8A84E]/40 space-y-1">
            <div className="font-bold text-[#E8A84E] flex items-center justify-between text-xs">
              <span>HINDCAST PARTICLE DISPERSION</span>
              <ProvenanceTag provenance="ESTIMATED" />
            </div>
            <p className="text-[#D5B76A] text-[10px]">
              MODEL: {originEstimate.hindcastModel}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
              <span className="text-[#68746F] block uppercase">EST. DISCHARGE TIME</span>
              <span className="font-bold text-[#E8EFEC]">
                {new Date(originEstimate.estimatedTimeWindow.mostProbable).toISOString().replace('T', ' ').replace('Z', '')}
              </span>
            </div>
            <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
              <span className="text-[#68746F] block uppercase">ORIGIN COORDINATES</span>
              <span className="font-bold text-[#5EE6C0]">
                {originEstimate.probableOriginLocation.lat.toFixed(4)}°N, {originEstimate.probableOriginLocation.lng.toFixed(4)}°E
              </span>
            </div>
          </div>
        </div>
      )}

      {activeStage === 'AIS_TRAFFIC_RECONSTRUCTION' && (
        <div className="space-y-2.5 font-mono text-[10px]">
          <div className="p-2.5 bg-[#161D1B] rounded-xs border border-[#29332F] space-y-1">
            <div className="font-bold text-xs text-[#5EE6C0] flex items-center justify-between">
              <span>DECODED AIS TRAFFIC MATRIX</span>
              <ProvenanceTag provenance="OBSERVED" />
            </div>
            <p className="text-[#A5B1AC] text-[11px]">
              7,252 Class-A kinematic packets ingested. 50 active vessels tracked across 25 km Ennore approach corridor.
            </p>
          </div>
        </div>
      )}

      {activeStage === 'CANDIDATE_VESSELS' && attributionResult && (
        <div className="space-y-1.5">
          <div className="text-[#68746F] font-mono text-[10px] uppercase">RANKED VESSEL MATRIX:</div>
          {attributionResult.candidates.map((cand) => (
            <div
              key={cand.vessel.mmsi}
              className={`p-2 rounded-xs border flex items-center justify-between font-mono ${
                cand.rank === 1
                  ? 'bg-[#1C1617] border-[#F05D5E]/60'
                  : 'bg-[#161D1B] border-[#202925]'
              }`}
            >
              <div>
                <div className="font-bold text-xs text-[#E8EFEC] flex items-center gap-1.5">
                  <span className={`w-4 h-4 rounded-xs text-[9px] flex items-center justify-center font-bold ${
                    cand.rank === 1 ? 'bg-[#F05D5E] text-white' : 'bg-[#29332F] text-[#A5B1AC]'
                  }`}>
                    #{cand.rank}
                  </span>
                  <span>{cand.vessel.name}</span>
                </div>
                <div className="text-[9px] text-[#68746F] mt-0.5">
                  MMSI: {cand.vessel.mmsi} • DIST: {(cand.closestApproachDistanceKm * 1000).toFixed(0)}m
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-bold ${cand.rank === 1 ? 'text-[#F05D5E]' : 'text-[#A5B1AC]'}`}>
                  {cand.overallScore}%
                </div>
                <div className="text-[8px] text-[#46514D]">MATCH</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeStage === 'SPATIO_TEMPORAL_CORRELATION' && attributionResult && (
        <div className="space-y-2.5 font-mono text-[10px]">
          <div className="p-2.5 bg-[#161D1B] rounded-xs border border-[#29332F] space-y-2">
            <div className="font-bold text-xs text-[#E8EFEC]">KINEMATIC ANOMALY METRICS</div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-2 bg-[#111716] rounded-xs border border-[#202925]">
                <span className="text-[#68746F] block uppercase">CO-LOCATION SCORE</span>
                <span className="text-sm font-bold text-[#5EE6C0]">
                  {attributionResult.primarySuspect.spatioTemporalScore}%
                </span>
              </div>
              <div className="p-2 bg-[#111716] rounded-xs border border-[#202925]">
                <span className="text-[#68746F] block uppercase">BEHAVIORAL ANOMALY</span>
                <span className="text-sm font-bold text-[#F05D5E]">
                  {attributionResult.primarySuspect.behavioralAnomalyScore}%
                </span>
              </div>
            </div>
            {attributionResult.primarySuspect.speedDropKnots && (
              <div className="p-2 bg-[#1C1617] text-[#F05D5E] rounded-xs border border-[#F05D5E]/40 text-[10px]">
                ⚠️ ABRUPT SPEED DROP DETECTED: -{attributionResult.primarySuspect.speedDropKnots} kts at collision node.
              </div>
            )}
          </div>
        </div>
      )}

      {activeStage === 'VESSEL_ATTRIBUTION' && attributionResult && (
        <div className="space-y-2.5">
          <div className="p-2.5 bg-[#1C1617] rounded-xs border border-[#F05D5E]/50 space-y-1.5">
            <div className="font-mono font-bold text-xs text-[#E8EFEC] flex items-center justify-between">
              <span>ATTRIBUTED: {attributionResult.primarySuspect.vessel.name}</span>
              <span className="px-1.5 py-0.2 bg-[#F05D5E] text-white rounded-xs font-mono text-[9px] font-bold">
                {attributionResult.overallAttributionConfidence}% CONF
              </span>
            </div>
            <p className="text-[#A5B1AC] text-[11px] leading-relaxed">
              {attributionResult.scientificSummary}
            </p>
          </div>

          <div className="space-y-1">
            <div className="font-mono text-[10px] text-[#68746F] uppercase">EVIDENTIARY PIECES:</div>
            {attributionResult.primarySuspect.evidence.map((ev) => (
              <div key={ev.id} className="p-2 bg-[#161D1B] rounded-xs border border-[#202925] space-y-0.5 text-[11px]">
                <div className="font-semibold text-[#E8EFEC] flex items-center justify-between">
                  <span>{ev.title}</span>
                  <ProvenanceTag provenance={ev.provenance} />
                </div>
                <p className="text-[#A5B1AC] text-[10px]">{ev.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeStage === 'INVESTIGATION_REPORT' && (
        <div className="space-y-2.5">
          <div className="p-3 bg-[#161D1B] rounded-xs border border-[#38B99A]/50 space-y-2">
            <div className="font-mono font-bold text-xs text-[#5EE6C0] flex items-center justify-between">
              <span>STATUTORY DOSSIER COMPILED</span>
              <ProvenanceTag provenance="DERIVED" />
            </div>
            <p className="text-[#A5B1AC] text-[11px]">
              Ready for transmission to Indian Coast Guard & DG Shipping authorities.
            </p>
            {onNavigateToReports && (
              <button
                type="button"
                onClick={onNavigateToReports}
                className="w-full py-2 px-3 bg-[#236B5B] hover:bg-[#38B99A] text-slate-950 font-mono font-bold text-xs rounded-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                <span>OPEN INVESTIGATION REPORT DOSSIER</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Key Findings Footer */}
      {phase.keyFindings && phase.keyFindings.length > 0 && (
        <div className="pt-2 border-t border-[#202925] font-mono text-[10px]">
          <span className="text-[#68746F] block mb-1 uppercase">PHASE FINDINGS:</span>
          <ul className="space-y-1 text-[#A5B1AC]">
            {phase.keyFindings.map((f, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-[#5EE6C0] font-bold">›</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
