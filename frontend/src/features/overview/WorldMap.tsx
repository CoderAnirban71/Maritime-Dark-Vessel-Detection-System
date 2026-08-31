import { useState } from "react";
import { Link } from "react-router-dom";
import { Crosshair, Layers3, LocateFixed, Navigation } from "lucide-react";
import type { OilSpillIncident } from "../../types/domain";
import { project } from "./logic";
import { Badge } from "../../components/ui";
import { formatCoord, formatUtc } from "../../lib/format";
export function WorldMap({
  items,
  selected,
  onSelect,
  layers,
  onLayer,
  onReset,
}: {
  items: OilSpillIncident[];
  selected?: OilSpillIncident;
  onSelect: (i: OilSpillIncident) => void;
  layers: Record<string, boolean>;
  onLayer: (key: string) => void;
  onReset: () => void;
}) {
  const [inspecting, setInspecting] = useState(false);
  const [cursor, setCursor] = useState<{ lat: number; lon: number }>();
  const switches: [string, string][] = [
    ["detections", "SAR"],
    ["eo", "EO"],
    ["currents", "Currents"],
    ["forecast", "Forecast"],
    ["uncertainty", "Uncertainty"],
  ];
  return (
    <div className="world-map" aria-label="Global incident map">
      <svg
        viewBox="0 0 1000 500"
        role="img"
        aria-label={`${items.length} simulated global spill incidents`}
        onPointerMove={(event) => {
          if (!inspecting) return;
          const box = event.currentTarget.getBoundingClientRect();
          setCursor({
            lon: ((event.clientX - box.left) / box.width) * 360 - 180,
            lat: 90 - ((event.clientY - box.top) / box.height) * 180,
          });
        }}
        onPointerLeave={() => setCursor(undefined)}
      >
        <defs>
          <pattern
            id="grid"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path d="M50 0H0V50" />
          </pattern>
          <pattern
            id="hatch"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(25)"
          >
            <path d="M0 0V8" />
          </pattern>
        </defs>
        <rect width="1000" height="500" className="sea" />
        <rect width="1000" height="500" fill="url(#grid)" />
        <path
          className="land"
          d="M70 82l112-41 78 48 22 87-48 76-31 113-94-26-39-127zm252-3 69-36 80 28 39 103-35 57-21 173-53 55-45-157-67-64 43-81zm251-20 107-20 89 42 70-18 92 64-41 76-107 22-47 88-83-20-31-84-70-57zm195 302 77-33 73 36-22 72-94 15-45-47z"
        />
        <path
          className="contour"
          d="M41 305c158-56 268 80 432 18s285-7 486-57M20 348c150-38 282 93 459 29s289-2 510-42"
        />
        {layers.currents &&
          Array.from({ length: 15 }, (_, i) => (
            <path
              key={i}
              className="current"
              d={`M${70 + i * 61} ${160 + (i % 4) * 66}l25 -12m-6-4l6 4-3 7`}
            />
          ))}
        {items.map((i) => {
          const p = project(i.geometry.centroid);
          const active = i.id === selected?.id;
          return (
            <g
              key={i.id}
              transform={`translate(${p.x * 10} ${p.y * 5})`}
              className={`incident-marker ${active ? "selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${i.id}, ${i.location}`}
              onClick={() => onSelect(i)}
              onKeyDown={(e) =>
                (e.key === "Enter" || e.key === " ") && onSelect(i)
              }
            >
              <ellipse rx={active ? 20 : 13} ry={active ? 11 : 7} />
              {layers.forecast && (
                <path
                  className="forecast"
                  d={`M10 5q40 ${i.driftBearing % 2 ? 30 : -30} 75 12`}
                />
              )}
              <text y="-15">{i.id.slice(-2)}</text>
            </g>
          );
        })}
      </svg>
      <div className="map-tools">
        <button
          title="Reset global view"
          onClick={() => {
            onReset();
            setInspecting(false);
            setCursor(undefined);
          }}
        >
          <LocateFixed />
        </button>
        <button
          title="Inspect coordinates"
          className={inspecting ? "active" : ""}
          aria-pressed={inspecting}
          onClick={() => setInspecting((value) => !value)}
        >
          <Crosshair />
        </button>
      </div>
      {inspecting && (
        <output className="map-coordinate" aria-live="polite">
          {cursor
            ? `${formatCoord(cursor.lat, "N", "S")} · ${formatCoord(cursor.lon, "E", "W")}`
            : "Move across map to inspect coordinates"}
        </output>
      )}
      <div className="layer-box">
        <span>
          <Layers3 /> LAYERS
        </span>
        {switches.map(([k, label]) => (
          <label key={k}>
            <input
              type="checkbox"
              checked={Boolean(layers[k])}
              onChange={() => onLayer(k)}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="map-legend">
        <span>
          <i className="legend-spill" /> Detection
        </span>
        <span>
          <i className="legend-current" /> Current
        </span>
        <span>
          <i className="legend-forecast" /> Forecast
        </span>
      </div>
      <div className="map-scale">
        0 <i /> 2,000 km
      </div>
      {selected && (
        <aside className="map-drawer">
          <div>
            <Badge tone={selected.simulated ? "coral" : "blue"}>
              {selected.simulated ? "SIMULATED" : "BACKEND RECORD"}
            </Badge>
            <Link
              className="button"
              to={`/incidents/${selected.id}`}
              aria-label="Open selected incident details"
            >
              <Navigation />
            </Link>
          </div>
          <strong>{selected.location}</strong>
          <span className="mono">
            {formatCoord(selected.geometry.centroid.lat, "N", "S")} ·{" "}
            {formatCoord(selected.geometry.centroid.lon, "E", "W")}
          </span>
          <dl>
            <dt>Area</dt>
            <dd>{selected.geometry.areaKm2} km²</dd>
            <dt>Confidence</dt>
            <dd>{Math.round(selected.confidence * 100)}%</dd>
            <dt>Observed</dt>
            <dd>{formatUtc(selected.lastObserved)}</dd>
            <dt>Drift</dt>
            <dd>{selected.driftBearing}°</dd>
          </dl>
          <Link className="button" to={`/analysis/${selected.id}`}>
            Open analysis
          </Link>
        </aside>
      )}
    </div>
  );
}
