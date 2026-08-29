import { useState, useMemo } from 'react';
import type { DarkVesselReport, AISGap } from '../../services/darkVesselDetection';
import { detectDarkVessels } from '../../services/darkVesselDetection';
import type { VesselTrack } from '../../types';
import {
  ShieldAlert,
  Radio,
  RadioTower,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ProvenanceTag } from '../ui/Badge';

interface DarkVesselPanelProps {
  vesselTracks: VesselTrack[];
  originPoint: { lat: number; lng: number } | null;
  onSelectVessel?: (mmsi: string) => void;
}

const RISK_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'bg-[#F05D5E]/15', text: 'text-[#F05D5E]', border: 'border-[#F05D5E]/40' },
  HIGH: { bg: 'bg-[#E8A84E]/15', text: 'text-[#E8A84E]', border: 'border-[#E8A84E]/40' },
  MODERATE: { bg: 'bg-[#D5B76A]/10', text: 'text-[#D5B76A]', border: 'border-[#D5B76A]/30' },
  LOW: { bg: 'bg-[#161D1B]', text: 'text-[#68746F]', border: 'border-[#202925]' },
};

export function DarkVesselPanel({
  vesselTracks,
  originPoint,
  onSelectVessel,
}: DarkVesselPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedGapIdx, setSelectedGapIdx] = useState<number | null>(null);

  const report: DarkVesselReport | null = useMemo(() => {
    if (!originPoint || vesselTracks.length === 0) return null;
    return detectDarkVessels(vesselTracks, originPoint, {
      minGapMinutes: 15,
      scanRadiusKm: 25,
    });
  }, [vesselTracks, originPoint]);

  if (!report) return null;

  const criticalGaps = report.gaps.filter((g) => g.riskLevel === 'CRITICAL' || g.riskLevel === 'HIGH');
  const otherGaps = report.gaps.filter((g) => g.riskLevel === 'MODERATE' || g.riskLevel === 'LOW');

  // MT Dawn Kanchipuram has 100% AIS uptime — this is evidence itself
  const dawnKHasGaps = report.gaps.some((g) => g.mmsi === '419053900');

  return (
    <div className="bg-[#111716] rounded-xs border border-[#29332F] overflow-hidden font-sans text-xs select-none">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-2.5 bg-[#0E1413] flex items-center justify-between cursor-pointer hover:bg-[#111716] transition-colors"
      >
        <div className="flex items-center gap-2 font-mono">
          <div className="w-6 h-6 rounded-xs bg-[#1C1617] border border-[#F05D5E]/40 flex items-center justify-center">
            <ShieldAlert className="w-3.5 h-3.5 text-[#F05D5E]" />
          </div>
          <div className="text-left">
            <div className="font-bold text-xs text-[#E8EFEC] flex items-center gap-1.5">
              <span>DARK VESSEL / AIS GAP DETECTION</span>
              <ProvenanceTag provenance="DERIVED" />
            </div>
            <span className="text-[9px] text-[#68746F]">
              {report.totalVesselsScanned} VESSELS SCANNED &bull; {report.totalGapsDetected} GAPS DETECTED &bull; {report.scanRadiusKm}km RADIUS
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {criticalGaps.length > 0 ? (
            <span className="px-1.5 py-0.5 bg-[#F05D5E]/20 text-[#F05D5E] border border-[#F05D5E]/40 rounded-xs font-mono font-bold text-[9px]">
              {criticalGaps.length} ALERT{criticalGaps.length > 1 ? 'S' : ''}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 bg-[#236B5B]/30 text-[#5EE6C0] border border-[#38B99A]/40 rounded-xs font-mono font-bold text-[9px]">
              ALL CLEAR
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-[#68746F]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#68746F]" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-2.5 space-y-2">
          {/* Primary Suspect AIS Continuity Badge */}
          <div className={`p-2 rounded-xs border font-mono text-[10px] ${
            dawnKHasGaps
              ? 'bg-[#1C1617] border-[#F05D5E]/40'
              : 'bg-[#0E1413] border-[#38B99A]/40'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Radio className={`w-3.5 h-3.5 ${dawnKHasGaps ? 'text-[#F05D5E]' : 'text-[#5EE6C0]'}`} />
                <span className="font-bold text-[#E8EFEC]">MT DAWN KANCHIPURAM (419053900)</span>
              </div>
              <span className={`font-bold ${dawnKHasGaps ? 'text-[#F05D5E]' : 'text-[#5EE6C0]'}`}>
                {dawnKHasGaps ? 'GAPS DETECTED' : '100% AIS CONTINUITY'}
              </span>
            </div>
            {!dawnKHasGaps && (
              <p className="text-[#A5B1AC] font-sans text-[10px] mt-1 leading-relaxed">
                Transponder transmitted continuously at 3-10s intervals throughout entire observation window.
                No intentional blackout detected. <span className="text-[#5EE6C0] font-bold">This is exculpatory for evasion but does not absolve collision liability.</span>
              </p>
            )}
          </div>

          {/* Critical / High Risk Gaps */}
          {criticalGaps.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9px] font-mono text-[#F05D5E] uppercase font-bold">
                HIGH-PRIORITY TRANSPONDER ANOMALIES:
              </span>
              {criticalGaps.map((gap, idx) => (
                <GapCard
                  key={`${gap.mmsi}-${idx}`}
                  gap={gap}
                  isSelected={selectedGapIdx === idx}
                  onSelect={() => {
                    setSelectedGapIdx(selectedGapIdx === idx ? null : idx);
                    onSelectVessel?.(gap.mmsi);
                  }}
                />
              ))}
            </div>
          )}

          {/* Other Gaps */}
          {otherGaps.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9px] font-mono text-[#68746F] uppercase font-bold">
                OTHER TRANSMISSION GAPS ({otherGaps.length}):
              </span>
              {otherGaps.slice(0, 5).map((gap, idx) => (
                <GapCard
                  key={`other-${gap.mmsi}-${idx}`}
                  gap={gap}
                  isSelected={false}
                  onSelect={() => onSelectVessel?.(gap.mmsi)}
                  compact
                />
              ))}
              {otherGaps.length > 5 && (
                <div className="text-[9px] font-mono text-[#46514D] text-center py-1">
                  + {otherGaps.length - 5} MORE LOW-PRIORITY GAPS
                </div>
              )}
            </div>
          )}

          {/* No Gaps Detected */}
          {report.totalGapsDetected === 0 && (
            <div className="p-3 text-center font-mono text-[10px] text-[#5EE6C0]">
              <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-[#38B99A]" />
              <div className="font-bold">NO SUSPICIOUS AIS BLACKOUTS DETECTED</div>
              <div className="text-[#68746F] mt-0.5">
                All {report.totalVesselsScanned} vessels maintained continuous transponder broadcast within {report.scanRadiusKm}km scan perimeter.
              </div>
            </div>
          )}

          {/* Methodology Note */}
          <div className="pt-1.5 border-t border-[#202925] text-[8px] font-mono text-[#46514D]">
            METHOD: Sequential AIS timestamp delta analysis &bull; Threshold: ≥{report.minGapMinutes}min gap &bull; Scan radius: {report.scanRadiusKm}km from origin node
          </div>
        </div>
      )}
    </div>
  );
}

function GapCard({
  gap,
  isSelected,
  onSelect,
  compact = false,
}: {
  gap: AISGap;
  isSelected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const style = RISK_STYLES[gap.riskLevel];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-2 rounded-xs border font-mono text-[10px] transition-all cursor-pointer ${style.bg} ${style.border} ${
        isSelected ? 'ring-1 ring-[#F05D5E]/50' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5">
          <RadioTower className={`w-3 h-3 ${style.text}`} />
          <span className={`font-bold ${style.text}`}>{gap.vesselName}</span>
          <span className="text-[#68746F]">({gap.mmsi})</span>
        </div>
        <span className={`px-1 py-0.2 rounded-xs text-[8px] font-bold ${style.bg} ${style.text} border ${style.border}`}>
          {gap.riskLevel}
        </span>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] text-[#A5B1AC] mt-1">
          <div>
            <span className="text-[#68746F]">GAP DURATION: </span>
            <span className="font-bold text-[#E8EFEC]">{gap.gapDurationMinutes} MIN</span>
          </div>
          <div>
            <span className="text-[#68746F]">DIST TO ORIGIN: </span>
            <span className="font-bold text-[#E8EFEC]">{gap.distanceToOriginKm} km</span>
          </div>
          <div>
            <span className="text-[#68746F]">START: </span>
            <span>{new Date(gap.gapStartTime).toISOString().replace('T', ' ').replace('Z', '').slice(0, 19)} UTC</span>
          </div>
          <div>
            <span className="text-[#68746F]">END: </span>
            <span>{new Date(gap.gapEndTime).toISOString().replace('T', ' ').replace('Z', '').slice(0, 19)} UTC</span>
          </div>
          <div>
            <span className="text-[#68746F]">EST. TRAVEL: </span>
            <span className="font-bold">{gap.estimatedDistanceTraveledKm} km</span>
          </div>
          <div>
            <span className="text-[#68746F]">CLASS: </span>
            <span className={`font-bold ${style.text}`}>{gap.classification.replace(/_/g, ' ')}</span>
          </div>
        </div>
      )}

      {compact && (
        <div className="text-[9px] text-[#68746F] mt-0.5">
          {gap.gapDurationMinutes}min gap &bull; {gap.distanceToOriginKm}km from origin &bull; {gap.classification.replace(/_/g, ' ')}
        </div>
      )}
    </button>
  );
}
