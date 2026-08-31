import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  Bell,
  BriefcaseBusiness,
  Database,
  FlaskConical,
  LayoutDashboard,
  Menu,
  RadioTower,
  Search,
  Settings,
  Ship,
  TriangleAlert,
  X,
} from "lucide-react";
import { getDataSource } from "../services";
const nav = [
  ["/overview", "Overview", LayoutDashboard],
  ["/incidents", "Incidents", TriangleAlert],
  ["/analysis", "Analysis Lab", FlaskConical],
  ["/vessels", "Vessel Explorer", Ship],
  ["/cases", "Cases", BriefcaseBusiness],
  ["/data-models", "Data & Models", Database],
  ["/settings", "Settings", Settings],
] as const;
const titles: Record<string, string> = {
  overview: "Global Spill Watch",
  incidents: "Incident Operations",
  analysis: "Satellite Analysis Lab",
  vessels: "AIS Vessel Explorer",
  cases: "Case Operations",
  "data-models": "Data & Model Health",
  settings: "Workspace Settings",
};
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 42 42" aria-label="Samudra Netra">
      <path d="M4 27c8-8 16 8 34-4M4 33c10-7 19 6 34-3M11 8l20 20M15 5l5 1-3 4z" />
    </svg>
  );
}
export function AppShell() {
  const [open, setOpen] = useState(false);
  const [utc, setUtc] = useState("");
  const loc = useLocation();
  const section = loc.pathname.split("/")[1] || "overview";
  useEffect(() => {
    const tick = () => setUtc(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => setOpen(false), [loc.pathname]);
  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className={`rail ${open ? "open" : ""}`}>
        <div className="brand">
          <Logo />
          <span>SAMUDRA NETRA</span>
        </div>
        <nav aria-label="Primary navigation">
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="rail-foot">
          <RadioTower />
          <span>
            SYSTEM
            <br />
            READY
          </span>
        </div>
      </aside>
      {open && (
        <button
          className="scrim"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="workspace">
        <header className="command">
          <button
            className="mobile-menu icon-button"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            {open ? <X /> : <Menu />}
          </button>
          <div>
            <span className="eyebrow">SAMUDRA NETRA / NTRO</span>
            <strong>{titles[section]}</strong>
          </div>
          <label className="global-search">
            <Search />
            <span className="sr-only">Global search</span>
            <input placeholder="Search incidents, vessels, cases" />
          </label>
          <div className="command-meta">
            <span className="source-dot" />
            <span>{getDataSource().toUpperCase()}</span>
            <span className="mono">{utc} UTC</span>
            <button className="icon-button" aria-label="Notifications">
              <Bell />
              <i>2</i>
            </button>
            <span className="avatar">AR</span>
          </div>
        </header>
        <main id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
