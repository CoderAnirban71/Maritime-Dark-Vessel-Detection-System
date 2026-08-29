import { useState, useEffect } from 'react';
import { getStoredReports, deleteReport } from '../../data/reportStore';
import type { InvestigationReport, ReportClassification } from '../../types';
import { ProvenanceTag } from '../ui/Badge';
import {
  FileText,
  Printer,
  Download,
  Trash2,
  Search,
} from 'lucide-react';

export function ReportsView() {
  const [reports, setReports] = useState<InvestigationReport[]>(getStoredReports());
  const [selectedReportId, setSelectedReportId] = useState<string | null>(reports[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReportClassification>('all');

  useEffect(() => {
    setReports(getStoredReports());
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Confirm deletion of this statutory investigation dossier?')) {
      const updated = deleteReport(id);
      setReports(updated);
      if (selectedReportId === id) {
        setSelectedReportId(updated[0]?.id || null);
      }
    }
  };

  const handleExportJson = (report: InvestigationReport, e: React.MouseEvent) => {
    e.stopPropagation();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${report.caseNumber}_attribution_dossier.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.vesselAttribution.primaryVesselName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.classification === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedReport = reports.find((r) => r.id === selectedReportId) || filteredReports[0] || null;

  return (
    <div className="flex h-full w-full bg-[#080C0B] p-2 gap-2 overflow-hidden text-xs select-none font-sans">
      {/* 1. Left Dossier Management List */}
      <div className="w-80 h-full bg-[#111716] rounded-xs border border-[#29332F] flex flex-col overflow-hidden flex-shrink-0 no-print">
        {/* Header & Search */}
        <div className="p-2.5 border-b border-[#202925] bg-[#0E1413] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-[#E8EFEC]">
              <FileText className="w-3.5 h-3.5 text-[#5EE6C0]" />
              <span>INVESTIGATION DOSSIERS [{filteredReports.length}]</span>
            </div>
            <ProvenanceTag provenance="DERIVED" />
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-[#68746F]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search case, vessel, authority..."
              className="w-full pl-7 pr-2 py-1 text-[11px] font-mono bg-[#161D1B] border border-[#29332F] rounded-xs text-[#E8EFEC] placeholder-[#46514D] focus:outline-none focus:border-[#5EE6C0]/50"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 font-mono text-[9px]">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-1.5 py-0.5 rounded-xs border uppercase transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#236B5B]/40 text-[#5EE6C0] border-[#38B99A]/60 font-bold'
                  : 'bg-[#161D1B] text-[#68746F] border-[#202925]'
              }`}
            >
              ALL
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('CONFIDENTIAL_LEGAL')}
              className={`px-1.5 py-0.5 rounded-xs border uppercase transition-colors cursor-pointer ${
                statusFilter === 'CONFIDENTIAL_LEGAL'
                  ? 'bg-[#1C1617] text-[#F05D5E] border-[#F05D5E]/60 font-bold'
                  : 'bg-[#161D1B] text-[#68746F] border-[#202925]'
              }`}
            >
              LEGAL DOSSIER
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('MARITIME_AUTHORITY')}
              className={`px-1.5 py-0.5 rounded-xs border uppercase transition-colors cursor-pointer ${
                statusFilter === 'MARITIME_AUTHORITY'
                  ? 'bg-[#1C2522] text-[#E8A84E] border-[#E8A84E]/60 font-bold'
                  : 'bg-[#161D1B] text-[#68746F] border-[#202925]'
              }`}
            >
              AUTHORITY BRIEF
            </button>
          </div>
        </div>

        {/* Reports Queue */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {filteredReports.length === 0 ? (
            <div className="p-6 text-center text-[#68746F] font-mono text-xs">
              NO INVESTIGATION DOSSIERS FOUND
            </div>
          ) : (
            filteredReports.map((r) => {
              const isSelected = r.id === selectedReport?.id;

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedReportId(r.id)}
                  className={`w-full text-left p-2.5 rounded-xs border transition-all cursor-pointer font-mono group relative ${
                    isSelected
                      ? 'bg-[#161D1B] border-[#5EE6C0]/70 shadow-xs'
                      : 'bg-[#111716] border-[#202925] hover:bg-[#161D1B] hover:border-[#29332F]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="font-bold text-xs text-[#E8EFEC] truncate">
                      {r.caseNumber}
                    </span>
                    <span className="text-[8px] px-1 py-0.2 rounded-xs font-bold bg-[#F05D5E]/20 text-[#F05D5E] border border-[#F05D5E]/40">
                      {r.vesselAttribution.attributionConfidencePercent}% CERTAINTY
                    </span>
                  </div>

                  <div className="text-[11px] text-[#A5B1AC] font-sans font-medium line-clamp-2 leading-snug mb-1.5">
                    {r.title}
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-[#68746F] pt-1 border-t border-[#202925]">
                    <span>{r.vesselAttribution.primaryVesselName}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleExportJson(r, e)}
                        className="text-[#68746F] hover:text-[#5EE6C0] p-0.5"
                        title="Download JSON Dossier"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(r.id, e)}
                        className="text-[#68746F] hover:text-[#F05D5E] p-0.5"
                        title="Delete Dossier"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Right Dossier Printable Canvas */}
      <div className="flex-1 h-full bg-[#111716] rounded-xs border border-[#29332F] flex flex-col overflow-hidden">
        {selectedReport ? (
          <>
            {/* Top Toolbar */}
            <div className="p-2 border-b border-[#202925] bg-[#0E1413] flex items-center justify-between font-mono no-print">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-[#E8EFEC]">
                  {selectedReport.caseNumber}
                </span>
                <span className="px-1.5 py-0.2 rounded-xs font-bold text-[9px] bg-[#F05D5E]/20 text-[#F05D5E] border border-[#F05D5E]/40">
                  {selectedReport.classification.replace('_', ' ')}
                </span>
                <ProvenanceTag provenance="DERIVED" />
              </div>

              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2.5 py-1 bg-[#161D1B] border border-[#29332F] text-[#E8EFEC] rounded-xs font-medium hover:bg-[#1C2522] flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#5EE6C0]" />
                  <span>PRINT / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleExportJson(selectedReport, e)}
                  className="px-2.5 py-1 bg-[#236B5B] hover:bg-[#38B99A] text-slate-950 font-bold rounded-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>EXPORT JSON</span>
                </button>
              </div>
            </div>

            {/* Document Surface */}
            <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto space-y-5 text-[#E8EFEC] leading-relaxed font-sans select-text">
              {/* Official Seal / Header */}
              <div className="text-center border-b border-[#29332F] pb-4 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#68746F] font-bold">
                  GOVERNMENT OF INDIA &bull; MINISTRY OF PORTS, SHIPPING AND WATERWAYS
                </div>
                <h1 className="text-sm font-mono font-bold text-[#E8EFEC] uppercase">
                  {selectedReport.authority}
                </h1>
                <div className="text-[10px] font-mono text-[#5EE6C0] font-semibold">
                  STATUTORY MARITIME OIL SPILL ATTRIBUTION DOSSIER
                </div>
              </div>

              {/* Case Metadata Grid */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-[#161D1B] rounded-xs border border-[#202925] font-mono text-[10px]">
                <div>
                  <span className="text-[#68746F] block uppercase">INCIDENT CASE ID</span>
                  <span className="font-bold text-[#E8EFEC]">{selectedReport.caseNumber}</span>
                </div>
                <div>
                  <span className="text-[#68746F] block uppercase">TECHNICAL REPORT DATE</span>
                  <span className="font-bold text-[#E8EFEC]">{new Date(selectedReport.generatedAt).toUTCString()}</span>
                </div>
                <div>
                  <span className="text-[#68746F] block uppercase">LEAD MARITIME INVESTIGATOR</span>
                  <span className="font-bold text-[#A5B1AC]">{selectedReport.author}</span>
                </div>
                <div>
                  <span className="text-[#68746F] block uppercase">ATTRIBUTION CONFIDENCE</span>
                  <span className="font-bold text-[#F05D5E]">
                    {selectedReport.vesselAttribution.attributionConfidencePercent}% CONFIRMED CERTAINTY
                  </span>
                </div>
              </div>

              {/* 1. Executive Summary */}
              <section className="space-y-1.5">
                <h2 className="text-xs font-mono font-bold text-[#5EE6C0] uppercase tracking-wider border-b border-[#202925] pb-1">
                  1. Executive Summary
                </h2>
                <p className="text-[#A5B1AC] text-justify text-xs leading-relaxed bg-[#161D1B] p-3 rounded-xs border border-[#202925]">
                  {selectedReport.executiveSummary}
                </p>
              </section>

              {/* 2. Satellite SAR Data */}
              <section className="space-y-1.5">
                <h2 className="text-xs font-mono font-bold text-[#5EE6C0] uppercase tracking-wider border-b border-[#202925] pb-1">
                  2. Satellite Earth Observation & Radar Signatures
                </h2>
                <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                  <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
                    <span className="text-[#68746F] block uppercase">SENSOR PLATFORM</span>
                    <span className="font-bold text-[#E8EFEC]">{selectedReport.satelliteFindings.satellite}</span>
                  </div>
                  <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
                    <span className="text-[#68746F] block uppercase">SLICK EXTENT</span>
                    <span className="font-bold text-[#5EE6C0]">{selectedReport.satelliteFindings.slickAreaKm2} km²</span>
                  </div>
                  <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
                    <span className="text-[#68746F] block uppercase">ACQUISITION MODE</span>
                    <span className="font-bold text-[#E8EFEC]">{selectedReport.satelliteFindings.sensorMode}</span>
                  </div>
                  <div className="p-2 bg-[#161D1B] rounded-xs border border-[#202925]">
                    <span className="text-[#68746F] block uppercase">COORDINATES</span>
                    <span className="font-bold text-[#A5B1AC]">{selectedReport.satelliteFindings.slickCoordinates}</span>
                  </div>
                </div>
              </section>

              {/* 3. Hindcast Analysis */}
              <section className="space-y-1.5">
                <h2 className="text-xs font-mono font-bold text-[#5EE6C0] uppercase tracking-wider border-b border-[#202925] pb-1">
                  3. Oceanographic & Wind Hindcast Model Analysis
                </h2>
                <div className="p-2.5 bg-[#1C2522] rounded-xs border border-[#E8A84E]/40 space-y-1 font-mono text-[10px]">
                  <div>
                    <span className="text-[#68746F]">CALCULATED ORIGIN: </span>
                    <span className="font-bold text-[#E8A84E]">{selectedReport.hindcastAnalysis.calculatedOriginCoords}</span>
                  </div>
                  <div>
                    <span className="text-[#68746F]">DISCHARGE WINDOW: </span>
                    <span className="font-bold text-[#E8EFEC]">{selectedReport.hindcastAnalysis.calculatedOriginTime}</span>
                  </div>
                  <div className="text-[#A5B1AC] text-[9px]">
                    OCEAN CURRENTS: {selectedReport.hindcastAnalysis.oceanCurrentSummary} &bull; WIND: {selectedReport.hindcastAnalysis.windVectorSummary}
                  </div>
                </div>
              </section>

              {/* 4. Attributed Vessel & Violations */}
              <section className="space-y-1.5">
                <h2 className="text-xs font-mono font-bold text-[#5EE6C0] uppercase tracking-wider border-b border-[#202925] pb-1">
                  4. Attributed Vessel & Statutory Violations
                </h2>
                <div className="p-3 bg-[#1C1617] rounded-xs border border-[#F05D5E]/40 space-y-2 font-mono">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-[#E8EFEC]">
                        {selectedReport.vesselAttribution.primaryVesselName}
                      </span>
                      <div className="text-[10px] text-[#A5B1AC]">
                        MMSI: {selectedReport.vesselAttribution.mmsi} &bull; IMO: {selectedReport.vesselAttribution.imo} &bull; FLAG: {selectedReport.vesselAttribution.flag}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-[#F05D5E] text-white rounded-xs font-bold text-[10px]">
                      {selectedReport.vesselAttribution.attributionConfidencePercent}% CERTAINTY
                    </span>
                  </div>

                  <div className="space-y-1 text-[10px]">
                    <span className="text-[#F05D5E] font-bold block uppercase">NOTED STATUTORY INFRACTIONS:</span>
                    <ul className="space-y-0.5 text-[#A5B1AC]">
                      {selectedReport.vesselAttribution.keyViolations.map((violation, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-[#F05D5E] font-bold">&bull;</span>
                          <span>{violation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              {/* 5. Evidentiary Chain */}
              <section className="space-y-1.5">
                <h2 className="text-xs font-mono font-bold text-[#5EE6C0] uppercase tracking-wider border-b border-[#202925] pb-1">
                  5. Corroborative Evidentiary Chain
                </h2>
                <div className="space-y-1.5">
                  {selectedReport.evidentiaryChain.map((ev, i) => (
                    <div key={ev.id} className="p-2.5 bg-[#161D1B] rounded-xs border border-[#202925] text-[11px] space-y-0.5">
                      <div className="font-mono font-bold text-[#E8EFEC] flex items-center justify-between text-xs">
                        <span>5.{i + 1} {ev.title}</span>
                        <span className="text-[#5EE6C0]">{ev.confidenceWeight}% WEIGHT</span>
                      </div>
                      <p className="text-[#A5B1AC] text-[10px]">{ev.description}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* 6. Sign-off */}
              <section className="pt-4 border-t border-[#29332F] flex justify-end">
                <div className="text-right space-y-0.5 border-t border-[#3A4741] pt-2 min-w-[200px] font-mono text-[10px]">
                  <div className="font-bold text-[#E8EFEC]">{selectedReport.signoff.officerName}</div>
                  <div className="text-[#A5B1AC]">{selectedReport.signoff.rank}</div>
                  <div className="text-[#68746F]">DATE: {selectedReport.signoff.date}</div>
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-[#68746F] font-mono text-xs">
            SELECT A REPORT DOSSIER TO LOAD
          </div>
        )}
      </div>
    </div>
  );
}
