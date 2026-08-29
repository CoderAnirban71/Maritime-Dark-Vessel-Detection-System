import type { WorkflowStageKey, WorkflowPhase } from '../../types';
import {
  Satellite,
  Search,
  Sliders,
  Compass,
  Radio,
  Users,
  GitBranch,
  ShieldAlert,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';

interface WorkflowStepperProps {
  phases: Record<WorkflowStageKey, WorkflowPhase>;
  activeStage: WorkflowStageKey;
  onSelectStage: (stage: WorkflowStageKey) => void;
}

const STAGE_CONFIG: Record<
  WorkflowStageKey,
  { label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }
> = {
  SATELLITE_OBSERVATION: { label: 'Satellite Observation', shortLabel: '01. SATELLITE', icon: Satellite },
  OIL_SLICK_DETECTION: { label: 'Oil Slick Detection', shortLabel: '02. DETECTION', icon: Search },
  SLICK_CHARACTERIZATION: { label: 'Slick Characterization', shortLabel: '03. MORPHOLOGY', icon: Sliders },
  ORIGIN_HINDCAST: { label: 'Origin & Hindcast', shortLabel: '04. HINDCAST', icon: Compass },
  AIS_TRAFFIC_RECONSTRUCTION: { label: 'AIS Traffic Reconstruction', shortLabel: '05. AIS RECON', icon: Radio },
  CANDIDATE_VESSELS: { label: 'Candidate Vessels', shortLabel: '06. CANDIDATES', icon: Users },
  SPATIO_TEMPORAL_CORRELATION: { label: 'Spatio-Temporal Correlation', shortLabel: '07. CORRELATION', icon: GitBranch },
  VESSEL_ATTRIBUTION: { label: 'Vessel Attribution', shortLabel: '08. ATTRIBUTION', icon: ShieldAlert },
  INVESTIGATION_REPORT: { label: 'Investigation Report', shortLabel: '09. DOSSIER', icon: FileCheck },
};

const STAGE_KEYS: WorkflowStageKey[] = [
  'SATELLITE_OBSERVATION',
  'OIL_SLICK_DETECTION',
  'SLICK_CHARACTERIZATION',
  'ORIGIN_HINDCAST',
  'AIS_TRAFFIC_RECONSTRUCTION',
  'CANDIDATE_VESSELS',
  'SPATIO_TEMPORAL_CORRELATION',
  'VESSEL_ATTRIBUTION',
  'INVESTIGATION_REPORT',
];

export function WorkflowStepper({ phases, activeStage, onSelectStage }: WorkflowStepperProps) {
  return (
    <div className="bg-[#0B0F0E] border-b border-[#29332F] px-3 py-1.5 overflow-x-auto select-none">
      <div className="flex items-center gap-1.5 min-w-max">
        {STAGE_KEYS.map((key, index) => {
          const config = STAGE_CONFIG[key];
          const phase = phases[key];
          const isActive = activeStage === key;
          const isCompleted = phase?.status === 'COMPLETED';
          const Icon = config.icon;

          return (
            <div key={key} className="flex items-center">
              <button
                type="button"
                onClick={() => onSelectStage(key)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-xs border font-mono text-[10px] uppercase transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#161D1B] text-[#5EE6C0] border-[#38B99A]/80 font-semibold shadow-xs'
                    : isCompleted
                    ? 'bg-[#111716] text-[#A5B1AC] border-[#29332F] hover:bg-[#161D1B] hover:text-[#E8EFEC]'
                    : 'bg-[#0E1413] text-[#46514D] border-[#202925] hover:text-[#68746F]'
                }`}
              >
                <div className="flex items-center justify-center">
                  {isCompleted && !isActive ? (
                    <CheckCircle2 className="w-3 h-3 text-[#38B99A]" />
                  ) : (
                    <Icon className="w-3 h-3 opacity-90" />
                  )}
                </div>
                <span>{config.shortLabel}</span>
              </button>

              {index < STAGE_KEYS.length - 1 && (
                <div className="w-2 h-px bg-[#202925] mx-0.5 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
