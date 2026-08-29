import { useState, useEffect } from 'react';
import {
  Satellite,
  Radio,
  Clock,
  Search,
  Wifi,
  Activity,
  Download,
} from 'lucide-react';
import { useSystemStatus, useVessels } from '../../hooks/useDataHooks';
import { useSpills } from '../../hooks/useSpills';
import { ProvenanceTag } from '../ui/Badge';
import { NotificationPopover } from '../common/NotificationPopover';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import { Toast, type ToastProps } from '../common/Toast';

interface TopHeaderProps {
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export function TopHeader({ searchQuery = '', onSearchChange }: TopHeaderProps) {
  const { status } = useSystemStatus();
  const { spills } = useSpills();
  const { vessels } = useVessels();
  const [utcTime, setUtcTime] = useState<string>('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [toasts, setToasts] = useState<Array<Omit<ToastProps, 'onDismiss'>>>([]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setUtcTime(now.toISOString().replace('T', ' ').replace('Z', ' UTC'));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Global Cmd+K / Ctrl+K search hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addToast = (title: string, message?: string, type: 'success' | 'warning' | 'info' = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts((t) => [...t, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  };

  const handleExportCsv = () => {
    const headers = ['id', 'code', 'name', 'areaKm2', 'confidenceScore', 'lat', 'lng', 'status', 'seaArea'];
    const rows = spills.map((s) => [
      s.id,
      s.code,
      `"${s.name}"`,
      s.geometry.areaKm2,
      s.confidenceScore,
      s.location.lat,
      s.location.lng,
      s.status,
      `"${s.location.seaArea}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `maritime_spill_detections_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('EXPORT COMPLETE', 'Slick detections exported as CSV.');
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ spills, vessels }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `samudra_netra_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);

    addToast('EXPORT COMPLETE', 'Telemetry & vessel records exported as JSON.');
  };

  return (
    <>
      <header className="h-12 bg-[#0B0F0E] border-b border-[#29332F] px-3 flex items-center justify-between flex-shrink-0 z-30 select-none font-sans">
        {/* 1. Left Station Identity & Operational Code */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xs bg-[#111716] border border-[#29332F] flex items-center justify-center text-[#5EE6C0]">
              <Activity className="w-4 h-4 text-[#5EE6C0]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-mono font-bold text-xs tracking-wider text-[#E8EFEC]">
                  SAMUDRA-NETRA // PS-26143
                </span>
                <span className="text-[9px] px-1 py-0.2 bg-[#236B5B]/30 text-[#5EE6C0] border border-[#38B99A]/40 font-mono rounded-xs">
                  OP-READY
                </span>
              </div>
              <span className="text-[9px] font-mono text-[#68746F] tracking-tight">
                SATELLITE SAR OIL SPILL INTEL & VESSEL FORENSICS CONSOLE
              </span>
            </div>
          </div>
        </div>

        {/* 2. Center: Global Search Bar */}
        <div className="hidden md:flex items-center max-w-md w-full mx-4">
          <div
            onClick={() => setIsSearchModalOpen(true)}
            className="relative w-full cursor-pointer group"
          >
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#68746F] group-hover:text-[#5EE6C0] transition-colors" />
            <input
              type="text"
              readOnly
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search MMSI, IMO, Vessel Call Sign, SAR Granule, Region..."
              className="w-full bg-[#111716] border border-[#29332F] group-hover:border-[#5EE6C0]/60 group-hover:bg-[#161D1B] rounded-xs pl-8 pr-8 py-1 text-xs text-[#E8EFEC] placeholder-[#46514D] font-mono transition-colors cursor-pointer focus:outline-none"
            />
            <div className="absolute right-2 top-1.5 text-[9px] font-mono text-[#68746F] bg-[#161D1B] px-1 rounded-xs border border-[#29332F]">
              ⌘K
            </div>
          </div>
        </div>

        {/* 3. Right: Telemetry, Export, Notifications & UTC Clock */}
        <div className="flex items-center gap-2 text-xs">
          {/* Live Ingestion Feed Status */}
          <div className="hidden lg:flex items-center gap-3 border-r border-[#29332F] pr-3 text-[11px] font-mono">
            <div className="flex items-center gap-1.5 text-[#A5B1AC]" title="Copernicus Sentinel-1 SAR Constellation">
              <Satellite className="w-3.5 h-3.5 text-[#5EE6C0]" />
              <span className="text-[#E8EFEC] font-semibold">S1-A/B</span>
              <span className="text-[9px] text-[#38B99A]">IW GRD</span>
            </div>

            <div className="flex items-center gap-1.5 text-[#A5B1AC]" title="Coastal & Satellite AIS Feed Active">
              <Radio className="w-3.5 h-3.5 text-[#5EE6C0] pulse-glow-anim" />
              <span className="text-[#E8EFEC] font-semibold">{status?.activeAISFeedCount || 50}</span>
              <span className="text-[9px] text-[#68746F]">AIS TX</span>
            </div>

            <div className="flex items-center gap-1.5 text-[#A5B1AC]" title="Copernicus Marine CMEMS Currents Active">
              <Wifi className="w-3.5 h-3.5 text-[#38B99A]" />
              <span className="text-[#68746F]">CMEMS 0.083°</span>
            </div>
          </div>

          {/* Quick Export Trigger */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-2 py-1 bg-[#111716] hover:bg-[#161D1B] border border-[#29332F] text-[#A5B1AC] hover:text-[#5EE6C0] rounded-xs font-mono text-[10px] flex items-center gap-1 cursor-pointer"
              title="Export Current Detections as CSV"
            >
              <Download className="w-3 h-3" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="px-2 py-1 bg-[#111716] hover:bg-[#161D1B] border border-[#29332F] text-[#A5B1AC] hover:text-[#5EE6C0] rounded-xs font-mono text-[10px] flex items-center gap-1 cursor-pointer"
              title="Export Incident Records as JSON"
            >
              <Download className="w-3 h-3" />
              <span>JSON</span>
            </button>
          </div>

          {/* Operational Alerts Popover */}
          <NotificationPopover />

          {/* Live Operational UTC Clock */}
          <div className="flex items-center gap-1.5 bg-[#111716] border border-[#29332F] px-2.5 py-1 rounded-xs font-mono text-[11px] text-[#A5B1AC]">
            <Clock className="w-3.5 h-3.5 text-[#5EE6C0]" />
            <span className="text-[#E8EFEC] font-semibold tracking-tight">{utcTime || 'UTC 00:00:00'}</span>
          </div>

          {/* Data Provenance Tag */}
          <div className="hidden sm:flex items-center gap-1.5">
            <ProvenanceTag provenance="OBSERVED" />
          </div>
        </div>
      </header>

      {/* Global Search Palette Modal */}
      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />

      {/* Toast Notifications Overlay */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            {...t}
            onDismiss={(id) => setToasts((prev) => prev.filter((x) => x.id !== id))}
          />
        ))}
      </div>
    </>
  );
}
