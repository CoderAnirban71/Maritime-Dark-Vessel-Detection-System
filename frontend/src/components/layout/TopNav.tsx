import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Settings,
  Waves,
  Radio,
  Satellite,
  ShieldCheck,
} from 'lucide-react';
import { useSystemStatus } from '../../hooks/useDataHooks';
import { ProvenanceTag } from '../ui/Badge';

export function TopNav() {
  const { status } = useSystemStatus();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Reports', path: '/reports', icon: FileText },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between flex-shrink-0 z-30 shadow-xs">
      {/* Brand & Mission Tag */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-teal-900 flex items-center justify-center shadow-xs">
          <Waves className="w-5 h-5 text-teal-300" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-slate-900">
              Samudra-Netra
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded font-semibold">
              PS-26143
            </span>
          </div>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Satellite SAR & AIS Maritime Oil Spill Intelligence
          </p>
        </div>
      </div>

      {/* Primary Navigation - Exactly 4 Sections */}
      <nav className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  isActive
                    ? 'bg-white text-teal-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`
              }
            >
              <Icon className="w-4 h-4 opacity-80" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Live System Status Indicator */}
      <div className="flex items-center gap-4 text-xs">
        <div className="hidden lg:flex items-center gap-3 border-r border-slate-200 pr-4 text-slate-600">
          <div className="flex items-center gap-1.5" title="Connected Satellite Constellations">
            <Satellite className="w-3.5 h-3.5 text-teal-700" />
            <span className="font-mono text-[11px]">4 Constellations</span>
          </div>
          <div className="flex items-center gap-1.5" title="Live AIS Receivers & Decoded Vessels">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span className="font-mono text-[11px]">
              {status?.activeAISFeedCount || 50} Vessels AIS
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ProvenanceTag provenance="OBSERVED" />
          <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium hidden sm:inline">Active</span>
          </div>
        </div>
      </div>
    </header>
  );
}
