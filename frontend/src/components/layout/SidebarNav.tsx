import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Settings,
} from 'lucide-react';

export function SidebarNav() {
  const navItems = [
    {
      label: 'Dashboard',
      code: 'DASH-01',
      path: '/',
      icon: LayoutDashboard,
      desc: 'Tactical Map & Attribution',
    },
    {
      label: 'Reports',
      code: 'REPO-02',
      path: '/reports',
      icon: FileText,
      desc: 'Evidentiary Dossiers',
    },
    {
      label: 'Analytics',
      code: 'ANAL-03',
      path: '/analytics',
      icon: BarChart3,
      desc: 'Regional Hotspots & Metrics',
    },
    {
      label: 'Settings',
      code: 'CONF-04',
      path: '/settings',
      icon: Settings,
      desc: 'Sensors & Attribution Weights',
    },
  ];

  return (
    <aside className="w-56 bg-[#0B0F0E] border-r border-[#29332F] flex flex-col justify-between flex-shrink-0 select-none">
      {/* 1. Main Navigation Items */}
      <div className="p-2 space-y-1">
        <div className="px-2.5 py-1.5 text-[9px] font-mono tracking-widest text-[#68746F] uppercase">
          CONSOLE MODULES
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `group flex items-center gap-2.5 px-2.5 py-2 rounded-xs border transition-all text-xs font-mono ${
                    isActive
                      ? 'bg-[#111716] text-[#5EE6C0] border-[#38B99A]/50 font-semibold shadow-xs'
                      : 'text-[#A5B1AC] border-transparent hover:bg-[#161D1B] hover:text-[#E8EFEC] hover:border-[#202925]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={`w-6 h-6 rounded-xs flex items-center justify-center flex-shrink-0 transition-colors ${
                        isActive
                          ? 'bg-[#236B5B]/30 text-[#5EE6C0]'
                          : 'bg-[#161D1B] text-[#68746F] group-hover:text-[#A5B1AC]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="truncate">{item.label}</span>
                        <span
                          className={`text-[8px] px-1 py-0.2 rounded-xs ${
                            isActive
                              ? 'bg-[#236B5B]/40 text-[#5EE6C0]'
                              : 'text-[#46514D]'
                          }`}
                        >
                          {item.code}
                        </span>
                      </div>
                      <div className="text-[9px] text-[#68746F] truncate group-hover:text-[#A5B1AC]">
                        {item.desc}
                      </div>
                    </div>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* 2. System Ground Station Footer Telemetry */}
      <div className="p-3 border-t border-[#29332F] bg-[#080C0B] space-y-2">
        <div className="flex items-center justify-between text-[9px] font-mono text-[#68746F]">
          <span>PIPELINE ENGINE</span>
          <span className="text-[#5EE6C0] font-semibold">ONLINE</span>
        </div>

        <div className="p-2 bg-[#111716] border border-[#202925] rounded-xs space-y-1 font-mono text-[9px] text-[#A5B1AC]">
          <div className="flex justify-between">
            <span className="text-[#68746F]">ALGORITHM:</span>
            <span className="text-[#E8EFEC]">S1A-AIS-HINDCAST</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#68746F]">ACCURACY:</span>
            <span className="text-[#5EE6C0]">98.2% CONF</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#68746F]">EEZ ZONE:</span>
            <span className="text-[#E8EFEC]">IND-EAST-BOB</span>
          </div>
        </div>

        <div className="text-[9px] font-mono text-[#46514D] text-center">
          SIH 2026 • PS-26143 • v1.0.0
        </div>
      </div>
    </aside>
  );
}
