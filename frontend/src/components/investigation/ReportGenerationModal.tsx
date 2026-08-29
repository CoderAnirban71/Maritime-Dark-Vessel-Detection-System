import { useState } from 'react';
import type { OilSpill, Investigation, AttributionCandidate, InvestigationReport } from '../../types';
import { createInvestigationReport } from '../../data/reportStore';
import { ProvenanceTag } from '../ui/Badge';
import {
  FileText,
  X,
  CheckCircle2,
  Printer,
  Loader2,
  FileCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ReportGenerationModalProps {
  spill: OilSpill;
  investigation: Investigation;
  selectedCandidate: AttributionCandidate;
  isOpen: boolean;
  onClose: () => void;
  onReportCreated?: (report: InvestigationReport) => void;
}

export function ReportGenerationModal({
  spill,
  investigation,
  selectedCandidate,
  isOpen,
  onClose,
  onReportCreated,
}: ReportGenerationModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<'compiling' | 'preview'>('compiling');
  const [generatedReport, setGeneratedReport] = useState<InvestigationReport | null>(null);
  const [investigatorName] = useState('Cmdr. R. Sharma (Indian Coast Guard / DG Shipping)');

  const handleStartGeneration = () => {
    setStep('compiling');
    setTimeout(() => {
      const report = createInvestigationReport(spill, investigation, selectedCandidate, investigatorName);
      setGeneratedReport(report);
      setStep('preview');
      onReportCreated?.(report);
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="bg-[#0B0F0E] border border-[#29332F] rounded-xs w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl font-sans text-xs">
        {/* Top Header */}
        <div className="p-3 border-b border-[#29332F] bg-[#111716] flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono">
            <FileText className="w-4 h-4 text-[#5EE6C0]" />
            <div>
              <div className="font-bold text-xs text-[#E8EFEC] flex items-center gap-2">
                <span>STATUTORY INVESTIGATION REPORT GENERATION</span>
                <ProvenanceTag provenance="DERIVED" />
              </div>
              <span className="text-[10px] text-[#68746F]">
                MARPOL 73/78 &bull; MERCHANT SHIPPING ACT 1958 PART XI-A
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {step === 'compiling' && !generatedReport ? (
            <div className="p-6 text-center space-y-4 font-mono">
              <div className="w-12 h-12 rounded-full bg-[#161D1B] border border-[#29332F] mx-auto flex items-center justify-center text-[#5EE6C0]">
                <Loader2 className="w-6 h-6 animate-spin text-[#5EE6C0]" />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-bold text-[#E8EFEC]">
                  COMPILING FORENSIC EVIDENTIARY DOSSIER...
                </div>
                <p className="text-[11px] text-[#68746F] max-w-md mx-auto">
                  Aggregating Sentinel-1A SAR backscatter attenuation matrices, Copernicus CMEMS reverse drift particles, and AIS Class-A collision deceleration records.
                </p>
              </div>

              <div className="p-3 bg-[#111716] rounded-xs border border-[#202925] max-w-md mx-auto text-left text-[10px] text-[#A5B1AC] space-y-1">
                <div className="flex items-center gap-1.5 text-[#5EE6C0]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sentinel-1 SAR Slick Geometry ({spill.geometry.areaKm2} km²)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#5EE6C0]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>CMEMS Drift Backward Particle Convergence (04:03 UTC)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#5EE6C0]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>AIS Trajectory of {selectedCandidate.vessel.name} ({selectedCandidate.overallScore}%)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#5EE6C0]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Deceleration Drop Anomaly (-{selectedCandidate.speedDropKnots || 11.2} kts)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartGeneration}
                className="px-4 py-2 bg-[#236B5B] hover:bg-[#38B99A] text-slate-950 font-bold rounded-xs cursor-pointer shadow-xs transition-colors"
              >
                PROCEED WITH SYNTHESIS
              </button>
            </div>
          ) : (
            generatedReport && (
              <div className="space-y-4">
                {/* Dossier Preview Banner */}
                <div className="p-3 bg-[#161D1B] rounded-xs border border-[#38B99A]/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#5EE6C0]" />
                    <div>
                      <span className="font-mono font-bold text-xs text-[#E8EFEC]">
                        DOSSIER {generatedReport.caseNumber} COMPILED & SIGNED
                      </span>
                      <span className="text-[10px] text-[#68746F] block font-mono">
                        Saved to local investigation repository and available in Reports module.
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-[#F05D5E] text-white rounded-xs font-mono font-bold text-[9px]">
                    {generatedReport.vesselAttribution.attributionConfidencePercent}% CONFIRMED
                  </span>
                </div>

                {/* Report Key Particulars */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-[#111716] rounded-xs border border-[#202925] font-mono text-[10px]">
                  <div>
                    <span className="text-[#68746F] block">ATTRIBUTED VESSEL:</span>
                    <span className="font-bold text-[#E8EFEC] text-xs">
                      {generatedReport.vesselAttribution.primaryVesselName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#68746F] block">MMSI / IMO / FLAG:</span>
                    <span className="text-[#A5B1AC]">
                      {generatedReport.vesselAttribution.mmsi} &bull; {generatedReport.vesselAttribution.imo} &bull; {generatedReport.vesselAttribution.flag}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#68746F] block">DISCHARGE ORIGIN NODE:</span>
                    <span className="text-[#E8A84E] font-bold">
                      {generatedReport.hindcastAnalysis.calculatedOriginCoords}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#68746F] block">ESTIMATED DISCHARGE TIME:</span>
                    <span className="text-[#E8EFEC]">
                      {generatedReport.hindcastAnalysis.calculatedOriginTime}
                    </span>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="space-y-1">
                  <span className="font-mono text-[10px] font-bold text-[#5EE6C0] uppercase">
                    Executive Summary:
                  </span>
                  <p className="text-[#A5B1AC] text-justify text-xs leading-relaxed bg-[#111716] p-2.5 rounded-xs border border-[#202925]">
                    {generatedReport.executiveSummary}
                  </p>
                </div>

                {/* Evidentiary Chain */}
                <div className="space-y-1.5 font-mono text-[10px]">
                  <span className="text-[#68746F] uppercase font-bold">Corroborative Evidentiary Chain:</span>
                  <div className="space-y-1">
                    {generatedReport.evidentiaryChain.map((ev, i) => (
                      <div key={ev.id} className="p-2 bg-[#111716] rounded-xs border border-[#202925] space-y-0.5">
                        <div className="flex items-center justify-between text-[#E8EFEC] font-bold">
                          <span>{i + 1}. {ev.title}</span>
                          <span className="text-[#5EE6C0]">{ev.confidenceWeight}% Weight</span>
                        </div>
                        <p className="text-[#A5B1AC] font-sans text-[10px]">{ev.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-3 bg-[#111716] border-t border-[#29332F] flex items-center justify-between font-mono text-[10px]">
          <span className="text-[#68746F]">
            LEAD OFFICER: {investigatorName}
          </span>

          <div className="flex items-center gap-2">
            {generatedReport && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/reports');
                  }}
                  className="px-3 py-1.5 bg-[#161D1B] border border-[#29332F] text-[#E8EFEC] hover:bg-[#1C2522] rounded-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileCheck className="w-3.5 h-3.5 text-[#5EE6C0]" />
                  <span>OPEN IN REPORTS MODULE</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-[#236B5B] hover:bg-[#38B99A] text-slate-950 font-bold rounded-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>PRINT / SAVE PDF</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
