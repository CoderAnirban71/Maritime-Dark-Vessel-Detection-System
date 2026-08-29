import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Ship, Waves, FileText, ArrowRight } from 'lucide-react';
import { useSpills } from '../../hooks/useSpills';
import { useVessels, useReports } from '../../hooks/useDataHooks';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const { spills } = useSpills();
  const { vessels } = useVessels();
  const { reports } = useReports();

  // Handle hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Toggle handled by parent or opened
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const term = searchTerm.toLowerCase().trim();

  const filteredSpills = spills.filter(
    (s) =>
      s.name.toLowerCase().includes(term) ||
      s.code.toLowerCase().includes(term) ||
      s.location.seaArea.toLowerCase().includes(term) ||
      s.satelliteObservation.rawGranuleId.toLowerCase().includes(term)
  );

  const filteredVessels = vessels.filter(
    (v) =>
      v.name.toLowerCase().includes(term) ||
      v.mmsi.includes(term) ||
      (v.imo && v.imo.includes(term)) ||
      v.type.toLowerCase().includes(term)
  );

  const filteredReports = reports.filter(
    (r) =>
      r.title.toLowerCase().includes(term) ||
      r.caseNumber.toLowerCase().includes(term) ||
      r.vesselAttribution.primaryVesselName.toLowerCase().includes(term)
  );

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center pt-16 bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="bg-[#0B0F0E] border border-[#29332F] rounded-xs w-full max-w-xl flex flex-col overflow-hidden shadow-2xl font-sans text-xs">
        {/* Search Input Bar */}
        <div className="p-3 border-b border-[#29332F] bg-[#111716] flex items-center gap-2">
          <Search className="w-4 h-4 text-[#5EE6C0]" />
          <input
            type="text"
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search MMSI, IMO, Vessel Name, Incident Code, SAR Granule, Dossier..."
            className="flex-1 bg-transparent border-none text-[#E8EFEC] placeholder-[#46514D] font-mono text-xs focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-[#68746F] hover:text-[#A5B1AC] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 bg-[#161D1B] border border-[#202925] rounded-xs text-[9px] font-mono text-[#68746F]">
            ESC
          </kbd>
        </div>

        {/* Search Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {/* 1. Detections / Spills */}
          {filteredSpills.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] font-mono text-[#68746F] uppercase px-2">
                SLICK INCIDENTS ({filteredSpills.length})
              </div>
              {filteredSpills.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/');
                  }}
                  className="w-full text-left p-2 rounded-xs hover:bg-[#161D1B] border border-transparent hover:border-[#202925] flex items-center justify-between group cursor-pointer font-mono"
                >
                  <div className="flex items-center gap-2">
                    <Waves className="w-3.5 h-3.5 text-[#5EE6C0]" />
                    <div>
                      <span className="font-bold text-[#E8EFEC] text-xs block">{s.code} &bull; {s.name}</span>
                      <span className="text-[10px] text-[#68746F]">{s.location.seaArea} ({s.geometry.areaKm2} km²)</span>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#68746F] opacity-0 group-hover:opacity-100 transition-opacity text-[#5EE6C0]" />
                </button>
              ))}
            </div>
          )}

          {/* 2. Vessels */}
          {filteredVessels.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] font-mono text-[#68746F] uppercase px-2">
                AIS TARGETS & VESSELS ({filteredVessels.length})
              </div>
              {filteredVessels.slice(0, 8).map((v) => (
                <button
                  key={v.mmsi}
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/');
                  }}
                  className="w-full text-left p-2 rounded-xs hover:bg-[#161D1B] border border-transparent hover:border-[#202925] flex items-center justify-between group cursor-pointer font-mono"
                >
                  <div className="flex items-center gap-2">
                    <Ship className={`w-3.5 h-3.5 ${v.mmsi === '419053900' ? 'text-[#F05D5E]' : 'text-[#38B99A]'}`} />
                    <div>
                      <span className="font-bold text-[#E8EFEC] text-xs block">{v.name}</span>
                      <span className="text-[10px] text-[#68746F]">MMSI: {v.mmsi} &bull; Type: {v.type} &bull; Flag: {v.flagCountry}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#68746F] opacity-0 group-hover:opacity-100 transition-opacity text-[#5EE6C0]" />
                </button>
              ))}
            </div>
          )}

          {/* 3. Reports */}
          {filteredReports.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] font-mono text-[#68746F] uppercase px-2">
                INVESTIGATION DOSSIERS ({filteredReports.length})
              </div>
              {filteredReports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/reports');
                  }}
                  className="w-full text-left p-2 rounded-xs hover:bg-[#161D1B] border border-transparent hover:border-[#202925] flex items-center justify-between group cursor-pointer font-mono"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#5EE6C0]" />
                    <div>
                      <span className="font-bold text-[#E8EFEC] text-xs block">{r.caseNumber} &bull; {r.title}</span>
                      <span className="text-[10px] text-[#68746F]">{r.authority}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#68746F] opacity-0 group-hover:opacity-100 transition-opacity text-[#5EE6C0]" />
                </button>
              ))}
            </div>
          )}

          {filteredSpills.length === 0 && filteredVessels.length === 0 && filteredReports.length === 0 && (
            <div className="p-6 text-center text-[#68746F] font-mono text-xs">
              NO MATCHES FOUND FOR &quot;{searchTerm}&quot;
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-[#111716] border-t border-[#29332F] font-mono text-[9px] text-[#68746F] flex items-center justify-between">
          <span>NAVIGATION: CLICK RESULT TO JUMP</span>
          <span>COMMAND CONSOLE</span>
        </div>
      </div>
    </div>
  );
}
