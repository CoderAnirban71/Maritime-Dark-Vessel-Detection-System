import type { AttributionCandidate, AttributionResult } from '../../types';
import { ProvenanceTag } from '../ui/Badge';
import { Ship, AlertOctagon, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AttributionEvidenceDossierProps {
  candidate: AttributionCandidate | null;
  attributionResult?: AttributionResult;
}

export function AttributionEvidenceDossier({
  candidate,
  attributionResult,
}: AttributionEvidenceDossierProps) {
  const navigate = useNavigate();

  if (!candidate) {
    return (
      <div className="bg-[#111716] rounded-xs border border-[#202925] p-4 text-center font-mono text-[10px] text-[#68746F]">
        SELECT A CANDIDATE VESSEL TO VIEW FORENSIC DOSSIER
      </div>
    );
  }

  const vessel = candidate.vessel;
  const isPrimary = candidate.rank === 1;

  return (
    <div className="bg-[#111716] rounded-xs border border-[#29332F] p-3 space-y-2.5 font-sans text-xs select-none flex flex-col">
      {/* 1. Header with Selected Vessel */}
      <div className="flex items-start justify-between border-b border-[#202925] pb-2">
        <div className="flex items-center gap-2 font-mono">
          <div
            className={`w-7 h-7 rounded-xs flex items-center justify-center ${
              isPrimary
                ? 'bg-[#1C1617] border border-[#F05D5E]/60 text-[#F05D5E]'
                : 'bg-[#161D1B] border border-[#29332F] text-[#5EE6C0]'
            }`}
          >
            <Ship className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-[#E8EFEC]">{vessel.name}</span>
              <span
                className={`text-[8px] px-1 py-0.2 rounded-xs font-bold ${
                  isPrimary
                    ? 'bg-[#F05D5E] text-white'
                    : 'bg-[#29332F] text-[#A5B1AC]'
                }`}
              >
                RANK #{candidate.rank}
              </span>
            </div>
            <span className="text-[10px] text-[#68746F]">
              MMSI: {vessel.mmsi} &bull; IMO: {vessel.imo || '9185449'} &bull; {vessel.flagCountry}
            </span>
          </div>
        </div>

        <div className="text-right font-mono">
          <span
            className={`text-sm font-bold ${
              isPrimary ? 'text-[#F05D5E]' : 'text-[#5EE6C0]'
            }`}
          >
            {candidate.overallScore}%
          </span>
          <span className="text-[8px] text-[#68746F] block">ATTRIBUTION</span>
        </div>
      </div>

      {/* 2. Kinematic Metrics Grid */}
      <div className="grid grid-cols-3 gap-1 font-mono text-center text-[10px]">
        <div className="p-1.5 bg-[#161D1B] rounded-xs border border-[#202925]">
          <span className="text-[#68746F] block text-[8px]">SPATIO-TEMP</span>
          <span className="font-bold text-[#5EE6C0]">{candidate.spatioTemporalScore}%</span>
        </div>
        <div className="p-1.5 bg-[#161D1B] rounded-xs border border-[#202925]">
          <span className="text-[#68746F] block text-[8px]">ANOMALY</span>
          <span
            className={`font-bold ${
              candidate.behavioralAnomalyScore > 50 ? 'text-[#F05D5E]' : 'text-[#A5B1AC]'
            }`}
          >
            {candidate.behavioralAnomalyScore}%
          </span>
        </div>
        <div className="p-1.5 bg-[#161D1B] rounded-xs border border-[#202925]">
          <span className="text-[#68746F] block text-[8px]">DIST TO ORIGIN</span>
          <span className="font-bold text-[#E8EFEC]">
            {(candidate.distanceToEstimatedOriginKm * 1000).toFixed(0)}m
          </span>
        </div>
      </div>

      {/* 3. Collision Anomaly Box */}
      {candidate.speedAnomalyDetected && (
        <div className="p-2 bg-[#1C1617] rounded-xs border border-[#F05D5E]/40 space-y-1 font-mono text-[10px]">
          <div className="flex items-center gap-1 font-bold text-[#F05D5E]">
            <AlertOctagon className="w-3.5 h-3.5 text-[#F05D5E]" />
            <span>KINEMATIC COLLISION SPEED DROP</span>
          </div>
          <p className="text-[#A5B1AC] leading-snug text-[10px]">
            Sudden deceleration of <span className="text-[#F05D5E] font-bold">-{candidate.speedDropKnots} kts</span> recorded at Ennore Fairway buoy intersection (04:03 UTC).
          </p>
        </div>
      )}

      {/* 4. Evidentiary Items */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between font-mono text-[10px] text-[#68746F] uppercase">
          <span>CORROBORATIVE EVIDENCE CHAIN</span>
          <ProvenanceTag provenance="DERIVED" />
        </div>

        <div className="space-y-1 max-h-36 overflow-y-auto">
          {candidate.evidence.map((ev) => (
            <div
              key={ev.id}
              className="p-1.5 bg-[#161D1B] rounded-xs border border-[#202925] font-mono text-[9px] space-y-0.5"
            >
              <div className="flex items-center justify-between font-bold text-[#E8EFEC]">
                <span>{ev.title}</span>
                <span className="text-[#5EE6C0]">{ev.confidenceWeight}%</span>
              </div>
              <p className="text-[#A5B1AC] font-sans text-[10px]">{ev.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Legal Conclusion & Button */}
      {attributionResult && isPrimary && (
        <div className="pt-2 border-t border-[#202925] space-y-2">
          <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925] font-mono text-[9px] text-[#A5B1AC] leading-relaxed">
            <span className="text-[#E8EFEC] font-bold block mb-0.5">STATUTORY ASSESSMENT:</span>
            {attributionResult.legalConclusion}
          </div>

          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="w-full py-1.5 bg-[#236B5B] hover:bg-[#38B99A] text-slate-950 font-mono font-bold text-xs rounded-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>VIEW SIGNED DOSSIER (REPORTS)</span>
          </button>
        </div>
      )}
    </div>
  );
}
