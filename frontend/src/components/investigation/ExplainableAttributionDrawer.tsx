import type { AttributionCandidate } from '../../types';
import { ProvenanceTag } from '../ui/Badge';
import { X, Ship, Activity, ShieldCheck, MapPin, Scale } from 'lucide-react';

interface ExplainableAttributionDrawerProps {
  candidate: AttributionCandidate | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ExplainableAttributionDrawer({
  candidate,
  isOpen,
  onClose,
}: ExplainableAttributionDrawerProps) {
  if (!isOpen || !candidate) return null;

  const vessel = candidate.vessel;
  const isPrimary = candidate.rank === 1;

  return (
    <div className="fixed inset-0 z-[2000] flex justify-end bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg h-full bg-[#0B0F0E] border-l border-[#29332F] flex flex-col shadow-2xl font-sans text-xs">
        {/* Drawer Header */}
        <div className="p-3 border-b border-[#29332F] bg-[#111716] flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono">
            <Scale className="w-4 h-4 text-[#5EE6C0]" />
            <div>
              <div className="font-bold text-xs text-[#E8EFEC] flex items-center gap-1.5">
                <span>EXPLAINABLE ATTRIBUTION ASSESSMENT</span>
                <ProvenanceTag provenance="DERIVED" />
              </div>
              <span className="text-[10px] text-[#68746F]">
                {vessel.name} &bull; MMSI {vessel.mmsi}
              </span>
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

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[11px]">
          {/* Total Attribution Score Hero */}
          <div
            className={`p-3 rounded-xs border flex items-center justify-between ${
              isPrimary
                ? 'bg-[#1C1617] border-[#F05D5E]/60'
                : 'bg-[#161D1B] border-[#29332F]'
            }`}
          >
            <div>
              <span className="text-[9px] text-[#68746F] uppercase block">
                COMPOSITE ATTRIBUTION CERTAINTY
              </span>
              <span className="text-lg font-bold text-[#E8EFEC]">
                {candidate.overallScore}% PROBABILITY MATCH
              </span>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-xs font-bold ${
                isPrimary
                  ? 'bg-[#F05D5E] text-white'
                  : 'bg-[#29332F] text-[#A5B1AC]'
              }`}
            >
              RANK #{candidate.rank}
            </span>
          </div>

          {/* Metric 1: Spatial Proximity */}
          <div className="p-3 bg-[#111716] rounded-xs border border-[#202925] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#5EE6C0] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                1. SPATIAL PROXIMITY & ORIGIN DISTANCE
              </span>
              <span className="font-bold text-[#E8EFEC]">
                {(candidate.distanceToEstimatedOriginKm * 1000).toFixed(0)} METERS
              </span>
            </div>
            <p className="text-[#A5B1AC] font-sans text-xs leading-relaxed">
              Vessel track came within <span className="font-mono text-[#5EE6C0] font-bold">{(candidate.closestApproachDistanceKm * 1000).toFixed(0)}m</span> of the CMEMS hydrodynamic backward drift convergence node. Well inside the 1,200m uncertainty radius boundary.
            </p>
            <div className="text-[9px] text-[#68746F] pt-1 border-t border-[#202925] flex justify-between">
              <span>WEIGHT: 45% COMPONENT</span>
              <span>SCORE: {candidate.spatioTemporalScore}%</span>
            </div>
          </div>

          {/* Metric 2: Temporal Co-Location */}
          <div className="p-3 bg-[#111716] rounded-xs border border-[#202925] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#5EE6C0] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                2. TEMPORAL SYNCHRONIZATION
              </span>
              <span className="font-bold text-[#E8EFEC]">04:03 UTC</span>
            </div>
            <p className="text-[#A5B1AC] font-sans text-xs leading-relaxed">
              Closest spatial approach occurred synchronously with the hindcast estimated release window (03:30 – 04:45 UTC). Zero significant time delta observed.
            </p>
            <div className="text-[9px] text-[#68746F] pt-1 border-t border-[#202925] flex justify-between">
              <span>WEIGHT: 35% COMPONENT</span>
              <ProvenanceTag provenance="ESTIMATED" />
            </div>
          </div>

          {/* Metric 3: Kinematic Deceleration Drop */}
          <div className="p-3 bg-[#111716] rounded-xs border border-[#202925] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#F05D5E] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                3. KINEMATIC COLLISION DECELERATION
              </span>
              <span className="font-bold text-[#F05D5E]">
                {candidate.speedAnomalyDetected ? `-${candidate.speedDropKnots} KTS` : 'NOMINAL'}
              </span>
            </div>
            <p className="text-[#A5B1AC] font-sans text-xs leading-relaxed">
              {candidate.speedAnomalyDetected
                ? `Vessel experienced sudden severe deceleration from 11.6 knots to 0.4 knots (-${candidate.speedDropKnots} kts) with a course deviation of ${candidate.courseAnomalyDegrees}° at 04:03 UTC upon collision with BW Maple.`
                : 'Vessel maintained consistent cruising speed with no abrupt deceleration anomalies.'}
            </p>
            <div className="text-[9px] text-[#68746F] pt-1 border-t border-[#202925] flex justify-between">
              <span>BEHAVIORAL ANOMALY SCORE</span>
              <span className="font-bold text-[#F05D5E]">{candidate.behavioralAnomalyScore}%</span>
            </div>
          </div>

          {/* Metric 4: AIS Transponder Continuity */}
          <div className="p-3 bg-[#111716] rounded-xs border border-[#202925] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#5EE6C0] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                4. AIS TRANSPONDER CONTINUITY
              </span>
              <span className="font-bold text-[#5EE6C0]">100% NOMINAL</span>
            </div>
            <p className="text-[#A5B1AC] font-sans text-xs leading-relaxed">
              Vessel continuously transmitted Class-A AIS messages at regular 3-to-10 second intervals throughout the entire 24-hour observation cycle. No intentional dark-vessel blackout periods.
            </p>
            <div className="text-[9px] text-[#68746F] pt-1 border-t border-[#202925] flex justify-between">
              <span>DATA PROVENANCE</span>
              <ProvenanceTag provenance="OBSERVED" />
            </div>
          </div>

          {/* Metric 5: Vessel Cargo Risk Profile */}
          <div className="p-3 bg-[#111716] rounded-xs border border-[#202925] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#E8A84E] flex items-center gap-1.5">
                <Ship className="w-3.5 h-3.5" />
                5. VESSEL CARGO & RISK PROFILE
              </span>
              <span className="font-bold text-[#E8EFEC]">{vessel.type}</span>
            </div>
            <p className="text-[#A5B1AC] font-sans text-xs leading-relaxed">
              Carrying petroleum hydrocarbon bunkers laden in cargo tanks. High risk category for marine pollution damage under MARPOL Annex I.
            </p>
          </div>
        </div>

        {/* Drawer Bottom Close */}
        <div className="p-3 bg-[#111716] border-t border-[#29332F] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#161D1B] hover:bg-[#1C2522] border border-[#29332F] text-[#E8EFEC] font-mono font-bold rounded-xs cursor-pointer"
          >
            CLOSE ASSESSMENT
          </button>
        </div>
      </div>
    </div>
  );
}
