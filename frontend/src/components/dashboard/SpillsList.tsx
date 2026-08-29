import type { OilSpill, SpillStatus } from '../../types';
import { StatusBadge, ProvenanceTag } from '../ui/Badge';
import { Search, MapPin, Crosshair } from 'lucide-react';

interface SpillsListProps {
  spills: OilSpill[];
  selectedSpillId: string | null;
  onSelectSpill: (id: string) => void;
  statusFilter: SpillStatus | 'all';
  onStatusFilterChange: (status: SpillStatus | 'all') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function SpillsList({
  spills,
  selectedSpillId,
  onSelectSpill,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
}: SpillsListProps) {
  return (
    <div className="flex flex-col h-full bg-[#111716] border border-[#29332F] rounded-xs overflow-hidden select-none">
      {/* 1. Header & Filters */}
      <div className="p-2.5 border-b border-[#202925] bg-[#0E1413] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-[#E8EFEC]">
            <Crosshair className="w-3.5 h-3.5 text-[#5EE6C0]" />
            <span>INCIDENT QUEUE [{spills.length}]</span>
          </div>
          <ProvenanceTag provenance="OBSERVED" />
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-[#68746F]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter by code, region, sensor..."
            className="w-full pl-7 pr-2 py-1 text-[11px] font-mono bg-[#161D1B] border border-[#29332F] rounded-xs text-[#E8EFEC] placeholder-[#46514D] focus:outline-none focus:border-[#5EE6C0]/50"
          />
        </div>

        {/* Technical Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[9px] font-mono">
          {(['all', 'detected', 'under_investigation', 'attributed', 'closed'] as const).map(
            (status) => {
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => onStatusFilterChange(status)}
                  className={`px-1.5 py-0.5 rounded-xs border uppercase transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#236B5B]/40 text-[#5EE6C0] border-[#38B99A]/60 font-semibold'
                      : 'bg-[#161D1B] text-[#68746F] border-[#202925] hover:text-[#A5B1AC]'
                  }`}
                >
                  {status === 'under_investigation' ? 'Correlating' : status}
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* 2. Spills List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#202925] p-1 space-y-1">
        {spills.length === 0 ? (
          <div className="p-6 text-center text-[#68746F] font-mono text-xs">
            NO SLICK DETECTIONS MATCH FILTER
          </div>
        ) : (
          spills.map((spill) => {
            const isSelected = spill.id === selectedSpillId;
            return (
              <button
                key={spill.id}
                type="button"
                onClick={() => onSelectSpill(spill.id)}
                className={`w-full text-left p-2.5 rounded-xs transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-[#161D1B] border-[#5EE6C0]/60 shadow-xs'
                    : 'bg-[#111716] border-[#202925] hover:bg-[#161D1B] hover:border-[#29332F]'
                }`}
              >
                {/* Code & Status Badge */}
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span className="font-mono font-bold text-xs text-[#E8EFEC] truncate">
                    {spill.code}
                  </span>
                  <StatusBadge status={spill.status} />
                </div>

                <div className="text-[11px] text-[#A5B1AC] font-medium leading-snug line-clamp-1 mb-1.5">
                  {spill.name}
                </div>

                <div className="flex items-center gap-1 text-[10px] font-mono text-[#68746F] mb-1.5">
                  <MapPin className="w-3 h-3 text-[#46514D] flex-shrink-0" />
                  <span className="truncate">{spill.location.seaArea}</span>
                </div>

                {/* Telemetry Footer */}
                <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-[#202925] font-mono text-[9px]">
                  <div>
                    <span className="text-[#68746F] block">AREA</span>
                    <span className="font-bold text-[#E8EFEC]">{spill.geometry.areaKm2} km²</span>
                  </div>
                  <div>
                    <span className="text-[#68746F] block">CONFIDENCE</span>
                    <span className="font-bold text-[#5EE6C0]">{spill.confidenceScore}%</span>
                  </div>
                  <div>
                    <span className="text-[#68746F] block">SENSOR</span>
                    <span className="font-bold text-[#A5B1AC]">{spill.satelliteObservation.platform}</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
