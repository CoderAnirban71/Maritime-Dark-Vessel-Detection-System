import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudSun, Compass, RotateCcw, Save, Wind } from "lucide-react";
import type { OilSpillIncident } from "../../types/domain";
import { getServices } from "../../services";
import { Badge, Panel, PanelHead, Skeleton } from "../../components/ui";
import { formatCoord, formatUtc } from "../../lib/format";
import { adjustSnapshots, BASELINE, type Scenario } from "./scenario";
export function DriftWorkspace({
  incident,
  compact = false,
  analystNote = "",
}: {
  incident: OilSpillIncident;
  compact?: boolean;
  analystNote?: string;
}) {
  const q = useQuery({
    queryKey: ["drift", incident.id],
    queryFn: () => getServices().drift.list(incident.id),
  });
  const queryClient = useQueryClient();
  const [scenario, setScenario] = useState<Scenario>(BASELINE);
  const [active, setActive] = useState(6);
  const [ran, setRan] = useState(false);
  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "error">(
    "",
  );
  const points = useMemo(
    () => adjustSnapshots(q.data?.data ?? [], scenario),
    [q.data, scenario],
  );
  const p = points[active];
  const origin = points[0]?.centroid ?? incident.geometry.centroid;
  const backendForcing = q.data?.source === "demo";
  const update = (key: keyof Scenario, value: number) => {
    setScenario((s) => ({ ...s, [key]: value }));
    setRan(false);
    setSaveState("");
  };
  const saveToCase = async () => {
    setSaveState("saving");
    try {
      const caseService = getServices("mock").cases;
      const existing = (await caseService.list()).data.find(
        (record) => record.incidentId === incident.id,
      );
      const now = new Date().toISOString();
      // A save is an audit snapshot, even when its controls match an earlier
      // run. Including its UTC timestamp prevents a newer run from being
      // silently collapsed by value-based de-duplication.
      const scenarioName = `OceanTrace ${scenario.window}h · wind ${scenario.windSpeed} kn @ ${scenario.windDirection}° · current ${scenario.currentSpeed.toFixed(2)} m/s · saved ${formatUtc(now)}`;
      const savedScenarios = [scenarioName, ...(existing?.savedScenarios ?? [])];
      await caseService.save({
        id: existing?.id ?? `CASE-${Date.now().toString().slice(-6)}`,
        incidentId: incident.id,
        status: existing?.status ?? "investigating",
        priority: existing?.priority ?? incident.severity,
        assignedAnalyst:
          existing?.assignedAnalyst ?? incident.assignedAnalyst ?? "Unassigned",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        evidenceCompleteness: Math.max(existing?.evidenceCompleteness ?? 0, 55),
        nextAction: "Review saved OceanTrace scenario",
        notes: Array.from(
          new Set([
            ...(existing?.notes ?? []),
            ...(analystNote.trim() ? [analystNote.trim()] : []),
          ]),
        ),
        pinnedEvidence: existing?.pinnedEvidence ?? [],
        savedScenarios,
      });
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };
  if (q.isLoading) return <Skeleton />;
  return (
    <div className={`drift-workspace ${compact ? "compact" : ""}`}>
      <div className="section-title">
        <div>
          <span className="eyebrow">04 / OCEANTRACE</span>
          <h2>Origin reconstruction & forecast</h2>
        </div>
        <Badge tone="yellow">SCENARIO OUTPUT · UNCERTAIN</Badge>
      </div>
      <div className="drift-layout">
        <Panel className="drift-map">
          <svg viewBox="0 0 800 390" aria-label="Drift reconstruction plot">
            <defs>
              <pattern
                id="dh"
                width="9"
                height="9"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(30)"
              >
                <path d="M0 0V9" />
              </pattern>
            </defs>
            <rect width="800" height="390" />
            <path className="coast" d="M0 280q120-64 220 0t210 3v107H0z" />
            <path
              className="uncertainty"
              d="M130 190q120-110 260-40t260 95q-170 77-294 20t-226-75z"
            />
            <path className="history" d="M120 225Q250 110 390 205" />
            <path className="future" d="M390 205q115 68 250 20" />
            {points.map((x, i) => (
              <g
                key={x.id}
                className={`${x.phase} ${i === active ? "active" : ""}`}
                transform={`translate(${130 + i * 42} ${225 - Math.sin(i * 0.8) * 34})`}
              >
                <ellipse
                  rx={7 + x.uncertaintyKm}
                  ry={4 + x.uncertaintyKm / 2}
                />
                <text y="-14">{i - 6}h</text>
              </g>
            ))}
            {Array.from({ length: 8 }, (_, i) => (
              <path
                key={i}
                className="vector"
                d={`M${90 + i * 90} ${90 + (i % 2) * 35}l28 14m-8-11l8 11-12 1`}
              />
            ))}
          </svg>
          <div className="drift-legend">
            <span>
              <i className="solid" /> Observation
            </span>
            <span>
              <i className="dashed" /> Hindcast
            </span>
            <span>
              <i className="hatched" /> Uncertainty
            </span>
            <span>
              <i className="teal-line" /> Forecast
            </span>
          </div>
          <input
            aria-label="Drift timeline"
            type="range"
            min="0"
            max={Math.max(0, points.length - 1)}
            value={active}
            onChange={(e) => setActive(+e.target.value)}
          />
          <div className="timeline-labels">
            <span>−36h HINDCAST</span>
            <b>{p ? formatUtc(p.at) : "Detection"}</b>
            <span>+36h FORECAST</span>
          </div>
        </Panel>
        <Panel className="scenario-controls">
          <PanelHead
            index="A"
            title="Scenario controls"
            aside={
              <button
                className="icon-button"
                title="Reset baseline"
                onClick={() => {
                  setScenario(BASELINE);
                  setRan(false);
                  setSaveState("");
                }}
              >
                <RotateCcw />
              </button>
            }
          />
          <label>
            Time window{" "}
            <select
              value={scenario.window}
              onChange={(e) => update("window", +e.target.value)}
            >
              {[6, 12, 24, 48, 72].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Wind speed <output>{scenario.windSpeed} kn</output>
            <input
              type="range"
              min="0"
              max="30"
              step=".5"
              value={scenario.windSpeed}
              onChange={(e) => update("windSpeed", +e.target.value)}
            />
          </label>
          <label>
            Wind direction <output>{scenario.windDirection}°</output>
            <input
              type="range"
              min="0"
              max="359"
              value={scenario.windDirection}
              onChange={(e) => update("windDirection", +e.target.value)}
            />
          </label>
          <label>
            Current speed <output>{scenario.currentSpeed} m/s</output>
            <input
              type="range"
              min="0"
              max="2"
              step=".01"
              value={scenario.currentSpeed}
              onChange={(e) => update("currentSpeed", +e.target.value)}
            />
          </label>
          <button className="primary" onClick={() => setRan(true)}>
            Recalculate scenario
          </button>
          {ran && <Badge tone="citron">LOCAL SCENARIO READY</Badge>}
          <button
            onClick={saveToCase}
            disabled={!ran || saveState === "saving"}
          >
            <Save /> Save to case
          </button>
          {saveState === "saved" && (
            <output className="scenario-save-status">
              Saved to case · visible in Case operations
            </output>
          )}
          {saveState === "error" && (
            <output className="scenario-save-status error">
              Could not save scenario
            </output>
          )}
        </Panel>
      </div>
      <div className="drift-stats">
        <Panel>
          <PanelHead index="B" title="Probable origin" />
          <strong>
            {formatCoord(origin.lat, "N", "S")} ·{" "}
            {formatCoord(origin.lon, "E", "W")}
          </strong>
          <p>{formatUtc(points[0]?.at ?? incident.firstDetected)}</p>
          <span>
            Radius {points[0]?.uncertaintyKm.toFixed(1) ?? "—"} km · Scenario
            estimate
          </span>
        </Panel>
        <Panel>
          <PanelHead index="C" title="Forecast coastline risk" />
          <ol>
            <li>
              <b>{incident.region} coastline</b>
              <span>Primary modeled exposure zone</span>
            </li>
            <li>
              <b>Adjacent harbour approaches</b>
              <span>Lower confidence beyond the observation window</span>
            </li>
          </ol>
        </Panel>
        <Panel>
          <PanelHead index="D" title="Why this path?" />
          <p>
            Southwesterly surface current dominates the first 18 hours. Windage
            shifts the centroid eastward; forecast spread grows rapidly beyond
            36 hours.
          </p>
          <small>
            Limitations: {backendForcing ? "sampled backend" : "synthetic"}
            forcing, no wave–slick interaction, and increasing forecast spread.
          </small>
        </Panel>
        <Panel>
          <PanelHead index="E" title="Input provenance" />
          <div className="provenance">
            <span>
              <Wind /> Wind <b>{backendForcing ? "ERA5 / DB" : "SYNTHETIC"}</b>
            </span>
            <span>
              <Compass /> Current{" "}
              <b>{backendForcing ? "CMEMS / DB" : "SYNTHETIC"}</b>
            </span>
            <span>
              <CloudSun /> Scene{" "}
              <b>{backendForcing ? "SENTINEL-1 SAFE" : "SYNTHETIC"}</b>
            </span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
