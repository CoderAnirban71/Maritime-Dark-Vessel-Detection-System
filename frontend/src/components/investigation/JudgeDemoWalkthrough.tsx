import { useState, useEffect } from 'react';
import type { WorkflowStageKey } from '../../types';
import {
  Compass,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
} from 'lucide-react';

export interface WalkthroughStep {
  number: number;
  title: string;
  shortDesc: string;
  stageKey: WorkflowStageKey;
  actionHint: string;
  triggerAction?: () => void;
}

interface JudgeDemoWalkthroughProps {
  activeStage: WorkflowStageKey;
  onSelectStage: (stage: WorkflowStageKey) => void;
  onSelectVessel: (mmsi: string) => void;
  onOpenSarModal: () => void;
  onOpenExplainDrawer: () => void;
  onOpenReportModal: () => void;
  onTimeChange: (isoTime: string) => void;
}

export function JudgeDemoWalkthrough({
  activeStage,
  onSelectStage,
  onSelectVessel,
  onOpenSarModal,
  onOpenExplainDrawer,
  onOpenReportModal,
  onTimeChange,
}: JudgeDemoWalkthroughProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const STEPS: WalkthroughStep[] = [
    {
      number: 1,
      title: 'OIL SPILL DETECTION ALERT',
      shortDesc: 'Satellite SAR detection SP-2017-001 flagged in Ennore Port approach corridor.',
      stageKey: 'OIL_SLICK_DETECTION',
      actionHint: 'Review active slick alert in the Incident Queue.',
      triggerAction: () => {
        onSelectStage('OIL_SLICK_DETECTION');
        onTimeChange('2017-01-29T00:31:32Z');
      },
    },
    {
      number: 2,
      title: 'INSPECT SATELLITE SAR EVIDENCE',
      shortDesc: 'Sentinel-1A C-band IW GRD pass observed dark patch with -6.4 dB radar attenuation.',
      stageKey: 'SATELLITE_OBSERVATION',
      actionHint: 'Opening high-res SAR granule scene viewer.',
      triggerAction: () => {
        onSelectStage('SATELLITE_OBSERVATION');
        onOpenSarModal();
      },
    },
    {
      number: 3,
      title: 'SLICK MORPHOLOGY & VOLUME',
      shortDesc: 'Geometric segmentation yields 19.45 km² surface area with ~2,850 m³ bunker volume.',
      stageKey: 'SLICK_CHARACTERIZATION',
      actionHint: 'Examine dimensions (8.4 km × 2.3 km) and 20.5h weathering age.',
      triggerAction: () => {
        onSelectStage('SLICK_CHARACTERIZATION');
      },
    },
    {
      number: 4,
      title: 'CMEMS HYDRODYNAMIC HINDCAST ORIGIN',
      shortDesc: 'Lagrangian reverse particle drift model tracks slick back to discharge node at 04:03 UTC.',
      stageKey: 'ORIGIN_HINDCAST',
      actionHint: 'Observe amber hindcast vector converging to 13.2415°N, 80.3412°E.',
      triggerAction: () => {
        onSelectStage('ORIGIN_HINDCAST');
        onTimeChange('2017-01-28T04:05:00Z');
      },
    },
    {
      number: 5,
      title: 'AIS CORRIDOR RECONSTRUCTION',
      shortDesc: 'Decoded 7,252 Class-A kinematic AIS messages across 50 vessels in the traffic lane.',
      stageKey: 'AIS_TRAFFIC_RECONSTRUCTION',
      actionHint: 'Playback AIS trajectories across the 24-hour observation window.',
      triggerAction: () => {
        onSelectStage('AIS_TRAFFIC_RECONSTRUCTION');
        onTimeChange('2017-01-28T04:03:00Z');
      },
    },
    {
      number: 6,
      title: 'CANDIDATE VESSEL SPATIAL FILTERING',
      shortDesc: '3 candidate vessels isolated based on proximity to origin node (< 5 km boundary).',
      stageKey: 'CANDIDATE_VESSELS',
      actionHint: 'Inspect ranked suspect table on the right console.',
      triggerAction: () => {
        onSelectStage('CANDIDATE_VESSELS');
      },
    },
    {
      number: 7,
      title: 'SPATIO-TEMPORAL & KINEMATIC CORRELATION',
      shortDesc: 'MT Dawn Kanchipuram exhibits 200m co-location with severe -11.2 kts speed drop.',
      stageKey: 'SPATIO_TEMPORAL_CORRELATION',
      actionHint: 'Select MT Dawn Kanchipuram (MMSI 419053900) on map/table.',
      triggerAction: () => {
        onSelectStage('SPATIO_TEMPORAL_CORRELATION');
        onSelectVessel('419053900');
        onTimeChange('2017-01-28T04:03:00Z');
      },
    },
    {
      number: 8,
      title: 'EXPLAINABLE FORENSIC ATTRIBUTION',
      shortDesc: '5-factor evidentiary breakdown validates 98% correlation probability.',
      stageKey: 'VESSEL_ATTRIBUTION',
      actionHint: 'Opening mathematical explainability assessment drawer.',
      triggerAction: () => {
        onSelectStage('VESSEL_ATTRIBUTION');
        onSelectVessel('419053900');
        onOpenExplainDrawer();
      },
    },
    {
      number: 9,
      title: 'PRIMARY SUSPECT ATTRIBUTION',
      shortDesc: 'MT Dawn Kanchipuram designated as primary liable source with MARPOL Annex I violations.',
      stageKey: 'VESSEL_ATTRIBUTION',
      actionHint: 'Confirm statutory infraction notices and evidentiary chain.',
      triggerAction: () => {
        onSelectStage('VESSEL_ATTRIBUTION');
        onSelectVessel('419053900');
      },
    },
    {
      number: 10,
      title: 'STATUTORY DOSSIER GENERATION',
      shortDesc: 'Compiling signed legal investigation report for DG Shipping & Indian Coast Guard.',
      stageKey: 'INVESTIGATION_REPORT',
      actionHint: 'Opening statutory report compiler modal.',
      triggerAction: () => {
        onSelectStage('INVESTIGATION_REPORT');
        onOpenReportModal();
      },
    },
  ];

  // Synchronize activeStage changes with walkthrough step index
  useEffect(() => {
    const STAGE_MAP: Record<WorkflowStageKey, number> = {
      OIL_SLICK_DETECTION: 0,
      SATELLITE_OBSERVATION: 1,
      SLICK_CHARACTERIZATION: 2,
      ORIGIN_HINDCAST: 3,
      AIS_TRAFFIC_RECONSTRUCTION: 4,
      CANDIDATE_VESSELS: 5,
      SPATIO_TEMPORAL_CORRELATION: 6,
      VESSEL_ATTRIBUTION: 7,
      INVESTIGATION_REPORT: 9,
    };
    const targetIdx = STAGE_MAP[activeStage];
    if (typeof targetIdx === 'number') {
      setCurrentStepIndex(targetIdx);
    }
  }, [activeStage]);

  const currentStep = STEPS[currentStepIndex];

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      STEPS[nextIdx].triggerAction?.();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      STEPS[prevIdx].triggerAction?.();
    }
  };

  const handleJumpToStep = (idx: number) => {
    setCurrentStepIndex(idx);
    STEPS[idx].triggerAction?.();
  };

  const handleStartWalkthrough = () => {
    setIsOpen(true);
    setCurrentStepIndex(0);
    STEPS[0].triggerAction?.();
  };

  return (
    <>
      {/* Trigger Bar in Header / Operational Strip */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
            } else {
              handleStartWalkthrough();
            }
          }}
          className={`px-2 py-1 rounded-xs border font-mono text-[10px] flex items-center gap-1.5 cursor-pointer transition-all ${
            isOpen
              ? 'bg-[#236B5B] text-slate-950 border-[#5EE6C0] font-bold shadow-xs'
              : 'bg-[#161D1B] hover:bg-[#1C2522] border-[#29332F] text-[#5EE6C0]'
          }`}
          title="Interactive SIH Judge Walkthrough (10-Step Pipeline)"
        >
          <Compass className="w-3.5 h-3.5 text-[#5EE6C0]" />
          <span className="hidden sm:inline">JUDGE PIPELINE WALKTHROUGH</span>
          <span className="sm:hidden">WALKTHROUGH</span>
          <span className="px-1 py-0.2 bg-[#0B0F0E] text-[#5EE6C0] text-[8px] rounded-xs font-bold border border-[#202925]">
            10-STEPS
          </span>
        </button>
      </div>

      {/* Floating Guided Walkthrough HUD */}
      {isOpen && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl bg-[#0B0F0E]/95 border border-[#38B99A]/60 rounded-xs shadow-2xl p-3 font-sans text-xs select-none backdrop-blur-md">
          {/* Top Step Header */}
          <div className="flex items-center justify-between border-b border-[#202925] pb-2 font-mono">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-[#236B5B] text-slate-950 font-bold text-[9px] rounded-xs">
                STEP {currentStep.number} OF 10
              </span>
              <span className="font-bold text-xs text-[#E8EFEC]">{currentStep.title}</span>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[#68746F] hover:text-[#E8EFEC] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description & Action Hint */}
          <div className="py-2.5 space-y-1">
            <p className="text-[#E8EFEC] font-medium text-xs leading-relaxed">
              {currentStep.shortDesc}
            </p>
            <div className="text-[10px] font-mono text-[#5EE6C0] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#5EE6C0]" />
              <span>ACTION: {currentStep.actionHint}</span>
            </div>
          </div>

          {/* Step Nodes & Navigation Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-[#202925] font-mono text-[10px]">
            {/* Step Quick-Jump Buttons */}
            <div className="flex items-center gap-1">
              {STEPS.map((s, idx) => (
                <button
                  key={s.number}
                  type="button"
                  onClick={() => handleJumpToStep(idx)}
                  className={`w-5 h-5 rounded-xs text-[9px] flex items-center justify-center font-bold transition-colors cursor-pointer ${
                    idx === currentStepIndex
                      ? 'bg-[#5EE6C0] text-slate-950 font-bold'
                      : idx < currentStepIndex
                      ? 'bg-[#236B5B]/40 text-[#5EE6C0] border border-[#38B99A]/50'
                      : 'bg-[#161D1B] text-[#68746F] hover:text-[#A5B1AC]'
                  }`}
                  title={s.title}
                >
                  {s.number}
                </button>
              ))}
            </div>

            {/* Prev / Next Action Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStepIndex === 0}
                className="px-2.5 py-1 bg-[#161D1B] hover:bg-[#1C2522] disabled:opacity-40 border border-[#29332F] text-[#E8EFEC] rounded-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>PREV</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={currentStepIndex === STEPS.length - 1}
                className="px-3 py-1 bg-[#236B5B] hover:bg-[#38B99A] disabled:opacity-40 text-slate-950 font-bold rounded-xs flex items-center gap-1 cursor-pointer"
              >
                <span>NEXT STEP</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
