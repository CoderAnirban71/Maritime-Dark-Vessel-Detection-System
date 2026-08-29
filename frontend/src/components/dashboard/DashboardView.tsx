import { useState, useMemo } from 'react';
import { useSpills } from '../../hooks/useSpills';
import { useInvestigation } from '../../hooks/useInvestigation';
import { useVessels } from '../../hooks/useDataHooks';
import { OperationalStrip } from './OperationalStrip';
import { SpillMap } from '../map/SpillMap';
import { SpillsList } from './SpillsList';
import { SlickAnalysisCard } from './SlickAnalysisCard';
import { TimelineScrubber } from './TimelineScrubber';
import { CandidateVesselTable } from './CandidateVesselTable';
import { AttributionEvidenceDossier } from '../vessel/AttributionEvidenceDossier';
import { SatelliteAnalysisModal } from './SatelliteAnalysisModal';
import { ReportGenerationModal } from '../investigation/ReportGenerationModal';
import { ExplainableAttributionDrawer } from '../investigation/ExplainableAttributionDrawer';
import { DarkVesselPanel } from '../investigation/DarkVesselPanel';
import { WorkflowStepper } from '../investigation/WorkflowStepper';
import { StageDetails } from '../investigation/StageDetails';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { SpillStatus, Vessel, VesselTrack } from '../../types';
import { Scale, FileText } from 'lucide-react';

export function DashboardView() {
  const navigate = useNavigate();
  const context = useOutletContext<{ globalSearch?: string }>();
  const [statusFilter, setStatusFilter] = useState<SpillStatus | 'all'>('all');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [selectedVesselMmsi, setSelectedVesselMmsi] = useState<string | null>('419053900'); // MT Dawn Kanchipuram
  const [timelineTimestamp, setTimelineTimestamp] = useState<string>('2017-01-29T00:31:32Z');
  const [isSarModalOpen, setIsSarModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isExplainDrawerOpen, setIsExplainDrawerOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'candidates' | 'stage_details'>('candidates');

  const searchQuery = context?.globalSearch || localSearch;

  const { spills, selectedSpill, selectedSpillId, setSelectedSpillId } = useSpills({
    status: statusFilter,
    searchQuery,
  });

  const { investigation, activeStage, setActiveStage } = useInvestigation(selectedSpillId);
  const { vessels } = useVessels();

  // Find currently selected candidate
  const selectedCandidate = useMemo(() => {
    if (!investigation?.attributionResult?.candidates) return null;
    return (
      investigation.attributionResult.candidates.find(
        (c) => c.vessel.mmsi === selectedVesselMmsi
      ) || investigation.attributionResult.candidates[0]
    );
  }, [investigation, selectedVesselMmsi]);

  // Extract filtered AIS vessel tracks for the map
  const vesselTracks = useMemo<VesselTrack[]>(() => {
    if (!vessels) return [];
    return vessels
      .map((v: Vessel) => v.track)
      .filter((t): t is VesselTrack => t !== undefined && t !== null);
  }, [vessels]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#080C0B] select-none font-sans">
      {/* 1. Top Operational Status Strip with Integrated Judge Demo Walkthrough */}
      <OperationalStrip
        spills={spills}
        selectedSpill={selectedSpill}
        investigation={investigation}
        vessels={vessels}
        activeStage={activeStage}
        onSelectStage={setActiveStage}
        onSelectVessel={setSelectedVesselMmsi}
        onOpenSarModal={() => setIsSarModalOpen(true)}
        onOpenExplainDrawer={() => setIsExplainDrawerOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        onTimeChange={setTimelineTimestamp}
      />

      {/* 2. 9-Stage Forensic Workflow Stepper */}
      {investigation && (
        <WorkflowStepper
          phases={investigation.phases}
          activeStage={activeStage}
          onSelectStage={setActiveStage}
        />
      )}

      {/* 3. Main Operational 3-Column Asymmetric Workspace */}
      <div className="flex-1 grid grid-cols-12 gap-2 p-2 overflow-hidden">
        {/* Left Column (3/12 cols): Incident Queue & Slick Morphometrics */}
        <div className="col-span-12 lg:col-span-3 h-full flex flex-col gap-2 overflow-hidden">
          <div className="flex-1 min-h-[220px] overflow-hidden">
            <SpillsList
              spills={spills}
              selectedSpillId={selectedSpillId}
              onSelectSpill={(id) => setSelectedSpillId(id)}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              searchQuery={localSearch}
              onSearchChange={setLocalSearch}
            />
          </div>
          <div className="flex-shrink-0">
            <SlickAnalysisCard
              spill={selectedSpill}
              onOpenSarInspector={() => setIsSarModalOpen(true)}
            />
          </div>
        </div>

        {/* Center Column (6/12 cols): Large Tactical Map & Kinematic Timeline */}
        <div className="col-span-12 lg:col-span-6 h-full flex flex-col gap-2 overflow-hidden">
          <div className="flex-1 relative overflow-hidden rounded-xs">
            <SpillMap
              selectedSpill={selectedSpill}
              investigation={investigation}
              vesselTracks={vesselTracks}
              selectedVesselMmsi={selectedVesselMmsi}
              timelineTimestamp={timelineTimestamp}
              onSelectVessel={(mmsi) => {
                setSelectedVesselMmsi(mmsi);
                setRightPanelTab('candidates');
              }}
            />
          </div>

          {/* Timeline Playback Scrubber */}
          <div className="flex-shrink-0">
            <TimelineScrubber
              currentTimestamp={timelineTimestamp}
              onTimeChange={setTimelineTimestamp}
            />
          </div>
        </div>

        {/* Right Column (3/12 cols): Ranked Candidate Vessels & Forensic Dossier */}
        <div className="col-span-12 lg:col-span-3 h-full flex flex-col gap-2 overflow-y-auto">
          {/* Tab Selector: Candidates Matrix vs Stage Details */}
          <div className="flex items-center gap-1 bg-[#111716] p-1 rounded-xs border border-[#202925] font-mono text-[10px]">
            <button
              type="button"
              onClick={() => setRightPanelTab('candidates')}
              className={`flex-1 py-1 rounded-xs uppercase transition-colors cursor-pointer text-center font-bold ${
                rightPanelTab === 'candidates'
                  ? 'bg-[#161D1B] text-[#5EE6C0] border border-[#38B99A]/50'
                  : 'text-[#68746F] hover:text-[#A5B1AC]'
              }`}
            >
              CANDIDATES & ATTRIBUTION
            </button>
            <button
              type="button"
              onClick={() => setRightPanelTab('stage_details')}
              className={`flex-1 py-1 rounded-xs uppercase transition-colors cursor-pointer text-center font-bold ${
                rightPanelTab === 'stage_details'
                  ? 'bg-[#161D1B] text-[#5EE6C0] border border-[#38B99A]/50'
                  : 'text-[#68746F] hover:text-[#A5B1AC]'
              }`}
            >
              STAGE DETAILS
            </button>
          </div>

          {/* Contextual Action Bar */}
          {selectedCandidate && (
            <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => setIsExplainDrawerOpen(true)}
                className="p-1.5 bg-[#161D1B] hover:bg-[#1C2522] border border-[#29332F] text-[#5EE6C0] font-bold rounded-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                title="Explain Attribution Scoring Model"
              >
                <Scale className="w-3 h-3" />
                <span>EXPLAIN SCORING</span>
              </button>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="p-1.5 bg-[#236B5B] hover:bg-[#38B99A] text-slate-950 font-bold rounded-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                title="Generate Formal Statutory Report"
              >
                <FileText className="w-3 h-3" />
                <span>GENERATE REPORT</span>
              </button>
            </div>
          )}

          {rightPanelTab === 'candidates' ? (
            <>
              {/* Ranked Candidates Table */}
              <div className="h-64 flex-shrink-0 overflow-hidden">
                <CandidateVesselTable
                  candidates={investigation?.attributionResult?.candidates || []}
                  selectedVesselMmsi={selectedVesselMmsi}
                  onSelectVessel={setSelectedVesselMmsi}
                />
              </div>

              {/* Dark Vessel / AIS Gap Detection */}
              <DarkVesselPanel
                vesselTracks={vesselTracks}
                originPoint={
                  investigation?.originEstimate?.probableOriginLocation || null
                }
                onSelectVessel={setSelectedVesselMmsi}
              />

              {/* Forensic Attribution Dossier */}
              <div className="flex-1 min-h-[280px]">
                <AttributionEvidenceDossier
                  candidate={selectedCandidate}
                  attributionResult={investigation?.attributionResult}
                />
              </div>
            </>
          ) : (
            investigation && (
              <div className="h-full">
                <StageDetails
                  investigation={investigation}
                  activeStage={activeStage}
                  onNavigateToReports={() => navigate('/reports')}
                />
              </div>
            )
          )}
        </div>
      </div>

      {/* 4. Satellite SAR Granule Analysis Modal */}
      {selectedSpill && (
        <SatelliteAnalysisModal
          observation={selectedSpill.satelliteObservation}
          isOpen={isSarModalOpen}
          onClose={() => setIsSarModalOpen(false)}
        />
      )}

      {/* 5. Explainable Attribution Assessment Drawer */}
      <ExplainableAttributionDrawer
        candidate={selectedCandidate}
        isOpen={isExplainDrawerOpen}
        onClose={() => setIsExplainDrawerOpen(false)}
      />

      {/* 6. Report Generation Modal */}
      {selectedSpill && investigation && selectedCandidate && (
        <ReportGenerationModal
          spill={selectedSpill}
          investigation={investigation}
          selectedCandidate={selectedCandidate}
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}
    </div>
  );
}
