import type { AttributionCandidate } from '../../types';
import { AlertTriangle, Crosshair } from 'lucide-react';
import { ProvenanceTag } from '../ui/Badge';

interface CandidateVesselTableProps {
  candidates: AttributionCandidate[];
  selectedVesselMmsi?: string | null;
  onSelectVessel: (mmsi: string) => void;
}

export function CandidateVesselTable({
  candidates,
  selectedVesselMmsi,
  onSelectVessel,
}: CandidateVesselTableProps) {
  return (
    <div className="bg-[#111716] rounded-xs border border-[#29332F] p-3 space-y-2.5 font-sans text-xs select-none flex flex-col h-full overflow-hidden">
      {/* 1. Header */}
      <div className="flex items-center justify-between border-b border-[#202925] pb-2">
        <div className="flex items-center gap-1.5 font-mono">
          <Crosshair className="w-3.5 h-3.5 text-[#5EE6C0]" />
          <span className="font-bold text-xs text-[#E8EFEC]">
            CANDIDATE VESSELS MATRIX [{candidates.length}]
          </span>
        </div>
        <ProvenanceTag provenance="DERIVED" />
      </div>

      {/* 2. Subtitle / Guidance */}
      <p className="text-[#68746F] font-mono text-[10px] leading-tight">
        Ranked by multi-factor spatial-temporal proximity, backward drift co-location, and kinematic speed drop anomaly.
      </p>

      {/* 3. Candidates List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        {candidates.map((cand) => {
          const isSelected = cand.vessel.mmsi === selectedVesselMmsi;
          const isPrimary = cand.rank === 1;
          const vessel = cand.vessel;

          return (
            <button
              key={vessel.mmsi}
              type="button"
              onClick={() => onSelectVessel(vessel.mmsi)}
              className={`w-full text-left p-2.5 rounded-xs border transition-all cursor-pointer font-mono ${
                isSelected
                  ? 'bg-[#161D1B] border-[#5EE6C0] shadow-xs'
                  : isPrimary
                  ? 'bg-[#1C1617] border-[#F05D5E]/60 hover:bg-[#20181A]'
                  : 'bg-[#161D1B] border-[#202925] hover:bg-[#1C2522] hover:border-[#29332F]'
              }`}
            >
              {/* Top Row: Rank, Name, Score */}
              <div className="flex items-start justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-4 h-4 rounded-xs text-[9px] flex items-center justify-center font-bold ${
                      isPrimary
                        ? 'bg-[#F05D5E] text-white'
                        : 'bg-[#29332F] text-[#A5B1AC]'
                    }`}
                  >
                    #{cand.rank}
                  </span>
                  <span className="font-bold text-xs text-[#E8EFEC] truncate max-w-[140px]">
                    {vessel.name}
                  </span>
                  <span className="text-[9px] text-[#68746F]">({vessel.type})</span>
                </div>

                <div className="text-right">
                  <span
                    className={`text-xs font-bold ${
                      isPrimary
                        ? 'text-[#F05D5E]'
                        : cand.overallScore >= 50
                        ? 'text-[#E8A84E]'
                        : 'text-[#38B99A]'
                    }`}
                  >
                    {cand.overallScore}%
                  </span>
                  <span className="text-[8px] text-[#68746F] block">MATCH</span>
                </div>
              </div>

              {/* Middle Row: MMSI, Distance, Closest Approach Time */}
              <div className="grid grid-cols-2 gap-1 text-[9px] text-[#A5B1AC] pt-1 border-t border-[#202925]">
                <div>
                  <span className="text-[#68746F]">MMSI:</span> {vessel.mmsi}
                </div>
                <div>
                  <span className="text-[#68746F]">APPROACH DIST:</span>{' '}
                  <span className="font-bold text-[#E8EFEC]">
                    {(cand.closestApproachDistanceKm * 1000).toFixed(0)}m
                  </span>
                </div>
                <div>
                  <span className="text-[#68746F]">APPROACH TIME:</span>{' '}
                  {cand.closestApproachTimestamp
                    ? new Date(cand.closestApproachTimestamp).toISOString().split('T')[1]?.slice(0, 5) + ' UTC'
                    : '04:03 UTC'}
                </div>
                <div>
                  <span className="text-[#68746F]">SPATIO-TEMP:</span> {cand.spatioTemporalScore}%
                </div>
              </div>

              {/* Bottom Anomaly Row if present */}
              {cand.speedAnomalyDetected && (
                <div className="mt-1.5 pt-1 border-t border-[#202925] flex items-center justify-between text-[9px] text-[#F05D5E]">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-[#F05D5E]" />
                    SPEED DROP ANOMALY: -{cand.speedDropKnots} kts
                  </span>
                  <span className="text-[8px] text-[#68746F]">IMPACT DETECTED</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
