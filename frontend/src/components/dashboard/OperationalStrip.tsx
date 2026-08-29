import type { OilSpill, Investigation, Vessel, WorkflowStageKey } from '../../types';
import { AlertOctagon, Satellite, Radio, Waves } from 'lucide-react';
import { ProvenanceTag } from '../ui/Badge';
import { JudgeDemoWalkthrough } from '../investigation/JudgeDemoWalkthrough';

interface OperationalStripProps {
  spills: OilSpill[];
  selectedSpill: OilSpill | null;
  investigation: Investigation | null;
  vessels: Vessel[];
  activeStage: WorkflowStageKey;
  onSelectStage: (stage: WorkflowStageKey) => void;
  onSelectVessel: (mmsi: string) => void;
  onOpenSarModal: () => void;
  onOpenExplainDrawer: () => void;
  onOpenReportModal: () => void;
  onTimeChange: (isoTime: string) => void;
}

export function OperationalStrip({
  spills,
  selectedSpill,
  investigation,
  vessels,
  activeStage,
  onSelectStage,
  onSelectVessel,
  onOpenSarModal,
  onOpenExplainDrawer,
  onOpenReportModal,
  onTimeChange,
}: OperationalStripProps) {
  const activeDetectionsCount = spills.length;
  const primarySuspectName = investigation?.attributionResult?.primarySuspect.vessel.name || 'None';
  const confidenceScore =
    investigation?.attributionResult?.overallAttributionConfidence || selectedSpill?.confidenceScore || 0;
  const totalAisPoints = vessels.reduce((acc, v) => acc + (v.track?.pointsCount || 0), 0);

  return (
    <div className="bg-[#0B0F0E] border-b border-[#29332F] px-3 py-2 flex items-center justify-between gap-3 overflow-x-auto select-none flex-shrink-0 font-sans">
      {/* 1. Left: Active Incident Code & Live State */}
      <div className="flex items-center gap-2 pr-3 border-r border-[#202925] min-w-max">
        <div className="w-2 h-2 rounded-full bg-[#5EE6C0] pulse-glow-anim" />
        <div>
          <span className="text-[9px] font-mono text-[#68746F] uppercase block">ACTIVE INCIDENT</span>
          <span className="font-mono font-bold text-xs text-[#E8EFEC]">
            {selectedSpill?.code || 'NO ACTIVE INCIDENT'}
          </span>
        </div>
      </div>

      {/* 2. Center: Dynamic Telemetry Metrics (Integrated Telemetry Bar) */}
      <div className="flex items-center gap-4 text-xs font-mono min-w-max">
        {/* Metric 1: Tracked Slicks */}
        <div className="flex items-center gap-1.5">
          <Waves className="w-3.5 h-3.5 text-[#5EE6C0]" />
          <div>
            <span className="text-[9px] text-[#68746F] block">TRACKED SLICKS</span>
            <span className="font-bold text-[#E8EFEC]">{activeDetectionsCount} DETECTIONS</span>
          </div>
        </div>

        {/* Metric 2: Primary Suspect */}
        <div className="flex items-center gap-1.5">
          <AlertOctagon className="w-3.5 h-3.5 text-[#F05D5E]" />
          <div>
            <span className="text-[9px] text-[#68746F] block">PRIMARY ATTRIBUTION</span>
            <span className="font-bold text-[#F05D5E] truncate max-w-[180px] block">
              {primarySuspectName} ({confidenceScore}%)
            </span>
          </div>
        </div>

        {/* Metric 3: Decoded AIS Vessels */}
        <div className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-[#38B99A]" />
          <div>
            <span className="text-[9px] text-[#68746F] block">AIS CORRIDOR RECON</span>
            <span className="font-bold text-[#E8EFEC]">
              {vessels.length} VESSELS ({totalAisPoints.toLocaleString()} TX)
            </span>
          </div>
        </div>

        {/* Metric 4: Satellite SAR Pass */}
        <div className="flex items-center gap-1.5">
          <Satellite className="w-3.5 h-3.5 text-[#5EE6C0]" />
          <div>
            <span className="text-[9px] text-[#68746F] block">SAR ACQUISITION</span>
            <span className="font-bold text-[#A5B1AC]">
              {selectedSpill?.satelliteObservation.platform} &bull; {selectedSpill?.satelliteObservation.mode} (10m)
            </span>
          </div>
        </div>
      </div>

      {/* 3. Right: Provenance Tag + Judge Demo Walkthrough Trigger */}
      <div className="flex items-center gap-2 pl-3 border-l border-[#202925] min-w-max">
        <ProvenanceTag provenance={selectedSpill?.provenance || 'OBSERVED'} />

        {/* Judge Demo Walkthrough Tool */}
        <JudgeDemoWalkthrough
          activeStage={activeStage}
          onSelectStage={onSelectStage}
          onSelectVessel={onSelectVessel}
          onOpenSarModal={onOpenSarModal}
          onOpenExplainDrawer={onOpenExplainDrawer}
          onOpenReportModal={onOpenReportModal}
          onTimeChange={onTimeChange}
        />
      </div>
    </div>
  );
}
