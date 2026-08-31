import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Satellite,
  ShieldAlert,
  TimerReset,
  type LucideIcon,
} from "lucide-react";
import { getServices } from "../../services";
import type { OilSpillIncident } from "../../types/domain";
import {
  Badge,
  ErrorState,
  Panel,
  PanelHead,
  Skeleton,
} from "../../components/ui";
import { formatNumber, formatUtc } from "../../lib/format";
import { filterIncidents, sortByUrgency, type OverviewFilters } from "./logic";
import { WorldMap } from "./WorldMap";
const trend = [12, 18, 14, 24, 29, 21, 34, 40, 37, 49, 44, 58, 53, 67];
type Metric = [LucideIcon, string, string | number, string];
function Metrics({ count }: { count: number }) {
  const metrics: Metric[] = [
    [ShieldAlert, "Active detections", count, "+2 / 24h"],
    [Activity, "Verified slicks", 4, "67% reviewed"],
    [TimerReset, "Under analysis", 3, "2 urgent"],
    [ArrowUpRight, "High-risk candidates", 5, "requires review"],
    [Satellite, "Scenes processed", 128, "+19 today"],
    [ArrowDownRight, "Median confidence", "84%", "−2 pts"],
  ];
  return (
    <div className="metric-ribbon">
      {metrics.map(([Icon, label, value, delta]) => (
        <div key={label}>
          <Icon className="metric-icon" />
          <span>{label}</span>
          <strong>{value}</strong>
          <small>{delta}</small>
        </div>
      ))}
    </div>
  );
}
export default function OverviewPage() {
  const q = useQuery({
    queryKey: ["incidents"],
    queryFn: () => getServices().incidents.list(),
  });
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<OilSpillIncident>();
  const [queueSort, setQueueSort] = useState<"urgency" | "freshness">(
    "urgency",
  );
  const [layers, setLayers] = useState<Record<string, boolean>>({
    detections: true,
    eo: true,
    currents: true,
    forecast: true,
    uncertainty: true,
  });
  const filters: OverviewFilters = {
    query: params.get("q") || "",
    severity: (params.get("severity") || "all") as OverviewFilters["severity"],
    status: (params.get("status") || "all") as OverviewFilters["status"],
    region: params.get("region") || "all",
  };
  const setFilter = (key: string, value: string) => {
    const n = new URLSearchParams(params);
    if (value === "all" || !value) n.delete(key);
    else n.set(key, value);
    setParams(n);
  };
  const filtered = filterIncidents(q.data?.data ?? [], filters);
  const items =
    queueSort === "urgency"
      ? sortByUrgency(filtered)
      : [...filtered].sort(
          (a, b) => Date.parse(b.lastObserved) - Date.parse(a.lastObserved),
        );
  const current = selected ?? items[0];
  const backendData = items.some((item) => !item.simulated);
  return (
    <div className="page overview">
      <div className="title-strip">
        <div>
          <span className="eyebrow">01 / GLOBAL OPERATIONS</span>
          <h1>Global Spill Watch</h1>
        </div>
        <Badge tone={backendData ? "blue" : "citron"}>
          {backendData ? "SAMUDRA API ACTIVE" : "SIMULATION ACTIVE"}
        </Badge>
        <span>
          Last sync <b className="mono">14:20 UTC</b>
        </span>
        <label>
          Range{" "}
          <select>
            <option>Last 72 hours</option>
            <option>Last 24 hours</option>
            <option>7 days</option>
          </select>
        </label>
      </div>
      <Metrics count={items.length} />
      <div className="overview-grid">
        <Panel className="map-panel">
          <div className="filterbar">
            <input
              aria-label="Search map incidents"
              placeholder="Search ID or location"
              value={filters.query}
              onChange={(e) => setFilter("q", e.target.value)}
            />
            <select
              aria-label="Severity"
              value={filters.severity}
              onChange={(e) => setFilter("severity", e.target.value)}
            >
              <option value="all">All severity</option>
              <option>critical</option>
              <option>high</option>
              <option>medium</option>
            </select>
            <select
              aria-label="Status"
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
            >
              <option value="all">All status</option>
              <option>new</option>
              <option>verified</option>
              <option>analysing</option>
              <option>monitoring</option>
            </select>
          </div>
          {q.isLoading ? (
            <Skeleton />
          ) : q.isError ? (
            <ErrorState message={q.error.message} retry={() => q.refetch()} />
          ) : (
            <WorldMap
              items={items}
              selected={current}
              onSelect={setSelected}
              layers={layers}
              onLayer={(key) => setLayers((x) => ({ ...x, [key]: !x[key] }))}
              onReset={() => {
                setSelected(items[0]);
                setLayers({
                  detections: true,
                  eo: true,
                  currents: true,
                  forecast: true,
                  uncertainty: true,
                });
              }}
            />
          )}
        </Panel>
        <Panel className="queue">
          <PanelHead
            index="A"
            title="Incident queue"
            aside={
              <Badge tone="coral">
                {items.filter((i) => i.severity === "critical").length} CRITICAL
              </Badge>
            }
          />
          <div className="queue-controls">
            <span>Priority-weighted</span>
            <button
              onClick={() =>
                setQueueSort((value) =>
                  value === "urgency" ? "freshness" : "urgency",
                )
              }
            >
              {queueSort === "urgency" ? "Urgency ↓" : "Freshness ↓"}
            </button>
          </div>
          <div className="queue-list">
            {items.map((i, index) => (
              <button
                key={i.id}
                className={`${i.id === current?.id ? "selected" : ""} ${i.severity}`}
                onClick={() => setSelected(i)}
              >
                <span className="rank">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <b>{i.id}</b>
                  <strong>{i.location}</strong>
                  <small>
                    {formatUtc(i.firstDetected)} · {i.sensor}
                  </small>
                </span>
                <span>
                  <Badge
                    tone={
                      i.severity === "critical"
                        ? "coral"
                        : i.severity === "high"
                          ? "yellow"
                          : "neutral"
                    }
                  >
                    {i.severity}
                  </Badge>
                  <b className="mono">{i.geometry.areaKm2} km²</b>
                </span>
              </button>
            ))}
          </div>
        </Panel>
      </div>
      <div className="lower-grid">
        <Panel>
          <PanelHead
            index="B"
            title="Detection volume · 14 days"
            aside={
              <span className="mono">
                {trend.reduce((a, b) => a + b, 0)} TOTAL
              </span>
            }
          />
          <div className="trend" aria-label="Detection volume chart">
            {trend.map((v, i) => (
              <i
                key={i}
                style={{ height: `${v}%` }}
                title={`${v} detections`}
              />
            ))}
          </div>
          <div className="axis">
            <span>17 AUG</span>
            <span>30 AUG</span>
          </div>
        </Panel>
        <Panel className="pipeline">
          <PanelHead index="C" title="Processing pipeline" />
          <ol>
            {[
              ["01", "INGEST", "healthy", "06 queued"],
              ["02", "PREPROCESS", "healthy", "12 active"],
              ["03", "SEGMENT", "degraded", "18 min p50"],
              ["04", "CORRELATE", "healthy", "04 active"],
            ].map((x) => (
              <li key={x[0]}>
                <b>{x[0]}</b>
                <span>{x[1]}</span>
                <Badge tone={x[2] === "degraded" ? "yellow" : "teal"}>
                  {x[2]}
                </Badge>
                <small>{x[3]}</small>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel>
          <PanelHead index="D" title="Regional distribution" />
          <div className="regions">
            {items.map((i) => (
              <div key={i.id}>
                <span>{i.region}</span>
                <i>
                  <b style={{ width: `${i.geometry.areaKm2 * 1.8}%` }} />
                </i>
                <em>{formatNumber(i.geometry.areaKm2)} km²</em>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
