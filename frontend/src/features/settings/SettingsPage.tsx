import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { getDataSource, getServices, type DataSource } from "../../services";
import { SCORE_WEIGHTS } from "../attribution/scoring";
import { Badge, Panel, PanelHead } from "../../components/ui";
interface Settings {
  source: DataSource;
  url: string;
  time: "utc" | "local";
  units: "metric" | "nautical";
  basemap: "signal" | "minimal";
  motion: "system" | "reduced";
  weights: Record<string, number>;
}
const defaults: Settings = {
  source: getDataSource(),
  url:
    localStorage.getItem("samudra-netra:backend-url") ||
    "http://localhost:8000",
  time: "utc",
  units: "metric",
  basemap: "signal",
  motion: "system",
  weights: { ...SCORE_WEIGHTS },
};
export default function SettingsPage() {
  const [settings, setSettings] = useState(defaults);
  const [message, setMessage] = useState("");
  const [health, setHealth] = useState("Not checked");
  const patch = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));
  const save = () => {
    if (settings.url && !/^https?:\/\//.test(settings.url)) {
      setMessage("Backend URL must begin with http:// or https://");
      return;
    }
    localStorage.setItem("samudra-netra:data-source", settings.source);
    localStorage.setItem("samudra-netra:backend-url", settings.url);
    setMessage("Settings saved. Reload to apply data-source changes.");
  };
  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">08 / WORKSPACE CONFIGURATION</span>
          <h1>Settings</h1>
          <p>
            Explicit source selection; no credentials are stored or requested.
          </p>
        </div>
        <Badge tone={settings.source === "mock" ? "citron" : "blue"}>
          {settings.source.toUpperCase()} SOURCE
        </Badge>
      </div>
      <div className="settings-grid">
        <Panel>
          <PanelHead index="A" title="Data source" />
          <fieldset>
            <legend>Runtime adapter</legend>
            <label className="choice">
              <input
                type="radio"
                checked={settings.source === "mock"}
                onChange={() => patch("source", "mock")}
              />
              <span>
                <b>Mock</b>
                <small>Complete deterministic synthetic experience</small>
              </span>
            </label>
            <label className="choice">
              <input
                type="radio"
                checked={settings.source === "demo"}
                onChange={() => patch("source", "demo")}
              />
              <span>
                <b>Samudra Netra API</b>
                <small>
                  AIS, environmental, spill-proximity and health queries
                </small>
              </span>
            </label>
          </fieldset>
          <label>
            Backend base URL
            <input
              value={settings.url}
              onChange={(e) => patch("url", e.target.value)}
              placeholder="http://localhost:8000"
            />
            <small>Environment default: VITE_DEMO_API_URL</small>
          </label>
          <button
            onClick={async () =>
              setHealth((await getServices("demo").models.health()).message)
            }
          >
            Check connection
          </button>
          <output>{health}</output>
        </Panel>
        <Panel>
          <PanelHead index="B" title="Display & map" />
          <label>
            Time display
            <select
              value={settings.time}
              onChange={(e) =>
                patch("time", e.target.value as Settings["time"])
              }
            >
              <option value="utc">UTC everywhere</option>
              <option value="local">Local with UTC reference</option>
            </select>
          </label>
          <label>
            Units
            <select
              value={settings.units}
              onChange={(e) =>
                patch("units", e.target.value as Settings["units"])
              }
            >
              <option value="metric">Metric</option>
              <option value="nautical">Nautical</option>
            </select>
          </label>
          <label>
            Map treatment
            <select
              value={settings.basemap}
              onChange={(e) =>
                patch("basemap", e.target.value as Settings["basemap"])
              }
            >
              <option value="signal">Samudra Netra contours</option>
              <option value="minimal">Minimal boundaries</option>
            </select>
          </label>
          <label>
            Motion
            <select
              value={settings.motion}
              onChange={(e) =>
                patch("motion", e.target.value as Settings["motion"])
              }
            >
              <option value="system">Follow system</option>
              <option value="reduced">Reduce motion</option>
            </select>
          </label>
        </Panel>
        <Panel className="weights">
          <PanelHead
            index="C"
            title="Attribution score weights"
            aside={<Badge tone="yellow">PRIORITIZATION ONLY</Badge>}
          />
          <p>
            Changing weights changes candidate ordering—not truth or legal
            responsibility.
          </p>
          {Object.entries(settings.weights).map(([k, v]) => (
            <label key={k}>
              {k} <output>{Math.round(v * 100)}%</output>
              <input
                type="range"
                min="0"
                max=".5"
                step=".01"
                value={v}
                onChange={(e) =>
                  patch("weights", {
                    ...settings.weights,
                    [k]: +e.target.value,
                  })
                }
              />
            </label>
          ))}
        </Panel>
      </div>
      <div className="settings-actions">
        <button
          onClick={() => {
            setSettings(defaults);
            setMessage("Defaults restored locally. Save to apply.");
          }}
        >
          <RotateCcw /> Reset
        </button>
        <button className="primary" onClick={save}>
          <Save /> Save settings
        </button>
        {message && <span role="status">{message}</span>}
      </div>
    </div>
  );
}
