import type { AttributionResult } from '../../types';
import { ProvenanceTag } from '../ui/Badge';
import { Ship, AlertOctagon, Scale } from 'lucide-react';

interface AttributionCardProps {
  attributionResult?: AttributionResult;
}

export function AttributionCard({ attributionResult }: AttributionCardProps) {
  if (!attributionResult) {
    return (
      <div className="bg-[#111716] rounded-xs border border-[#202925] p-3 text-center font-mono text-[10px] text-[#68746F]">
        ATTRIBUTION CALCULATIONS PENDING FOR THIS SLICK
      </div>
    );
  }

  const primary = attributionResult.primarySuspect;
  const vessel = primary.vessel;

  return (
    <div className="bg-[#111716] rounded-xs border border-[#29332F] p-3 space-y-2.5 font-sans text-xs">
      {/* 1. Header */}
      <div className="flex items-start justify-between border-b border-[#202925] pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xs bg-[#1C1617] border border-[#F05D5E]/40 flex items-center justify-center text-[#F05D5E]">
            <Ship className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-bold text-xs text-[#E8EFEC]">{vessel.name}</span>
              <span className="text-[9px] px-1 py-0.2 bg-[#F05D5E]/20 text-[#F05D5E] border border-[#F05D5E]/40 rounded-xs font-bold">
                RANK #{primary.rank}
              </span>
            </div>
            <p className="text-[10px] font-mono text-[#68746F]">
              MMSI: <span className="text-[#A5B1AC]">{vessel.mmsi}</span> • FLAG: {vessel.flagCountry}
            </p>
          </div>
        </div>
        <div className="text-right font-mono">
          <div className="text-sm font-bold text-[#F05D5E]">{primary.overallScore}%</div>
          <div className="text-[8px] text-[#68746F]">ATTRIBUTION</div>
        </div>
      </div>

      {/* 2. Metrics Grid */}
      <div className="grid grid-cols-3 gap-1 font-mono text-center text-[10px]">
        <div className="p-1.5 bg-[#161D1B] rounded-xs border border-[#202925]">
          <span className="text-[#68746F] block text-[9px]">SPATIO-TEMP</span>
          <span className="font-bold text-[#5EE6C0]">{primary.spatioTemporalScore}%</span>
        </div>
        <div className="p-1.5 bg-[#161D1B] rounded-xs border border-[#202925]">
          <span className="text-[#68746F] block text-[9px]">ANOMALY</span>
          <span className="font-bold text-[#F05D5E]">{primary.behavioralAnomalyScore}%</span>
        </div>
        <div className="p-1.5 bg-[#161D1B] rounded-xs border border-[#202925]">
          <span className="text-[#68746F] block text-[9px]">DIST ORIGIN</span>
          <span className="font-bold text-[#E8EFEC]">{(primary.distanceToEstimatedOriginKm * 1000).toFixed(0)}m</span>
        </div>
      </div>

      {/* 3. Speed Anomaly Alert */}
      {primary.speedAnomalyDetected && (
        <div className="p-2 bg-[#1C1617] rounded-xs border border-[#F05D5E]/40 text-[#F05D5E] space-y-0.5">
          <div className="flex items-center gap-1 font-mono font-bold text-[10px]">
            <AlertOctagon className="w-3 h-3 text-[#F05D5E]" />
            KINEMATIC COLLISION SPEED DROP
          </div>
          <p className="text-[10px] text-[#A5B1AC] leading-snug font-mono">
            Speed dropped abruptly by -{primary.speedDropKnots} kts with {primary.courseAnomalyDegrees}° course deviation at 04:03 UTC.
          </p>
        </div>
      )}

      {/* 4. Legal Assessment */}
      <div className="pt-2 border-t border-[#202925] space-y-1">
        <div className="flex items-center justify-between font-mono text-[10px]">
          <span className="font-bold text-[#A5B1AC] flex items-center gap-1">
            <Scale className="w-3 h-3 text-[#68746F]" />
            STATUTORY CONCLUSION
          </span>
          <ProvenanceTag provenance="DERIVED" />
        </div>
        <p className="text-[#68746F] text-[10px] leading-relaxed">
          {attributionResult.legalConclusion}
        </p>
      </div>
    </div>
  );
}
