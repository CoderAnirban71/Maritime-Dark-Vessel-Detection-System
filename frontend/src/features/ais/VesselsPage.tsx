import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pause, Play, RotateCcw, Ship, SkipBack } from "lucide-react";
import { getDataSource, getServices } from "../../services";
import {
  Badge,
  ErrorState,
  Panel,
  PanelHead,
  Skeleton,
} from "../../components/ui";
import { AttributionTable } from "../attribution/AttributionTable";
import { formatUtc } from "../../lib/format";
export default function VesselsPage() {
  const source = getDataSource();
  const q = useQuery({
    queryKey: ["vessels"],
    queryFn: ({ signal }) => getServices().ais.list(undefined, signal),
  });
  const incidents = useQuery({
    queryKey: ["vessel-page-incidents", source],
    queryFn: ({ signal }) => getServices().incidents.list(signal),
    enabled: source === "demo",
  });
  const [selected, setSelected] = useState("VES-1");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [replay, setReplay] = useState(12);
  const [playing, setPlaying] = useState(false);
  const rows = useMemo(
    () =>
      (q.data?.data ?? []).filter(
        (v) =>
          (type === "all" || v.type === type) &&
          (!onlyGaps || v.aisGapHours > 1) &&
          `${v.name} ${v.imo}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [q.data, type, onlyGaps, query],
  );
  const maxReplay = Math.max(1, ...rows.map((v) => v.track.length));
  const vessel = (q.data?.data ?? []).find((v) => v.id === selected) ?? rows[0];
  const mapBounds = useMemo(() => {
    const points = rows.flatMap((item) => item.track);
    if (!points.length)
      return { minLat: 12.8, maxLat: 13.6, minLon: 79.8, maxLon: 80.6 };
    const lats = points.map((point) => point.lat);
    const lons = points.map((point) => point.lon);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    };
  }, [rows]);
  const project = (lat: number, lon: number) => ({
    x:
      55 +
      ((lon - mapBounds.minLon) /
        Math.max(0.0001, mapBounds.maxLon - mapBounds.minLon)) *
        690,
    y:
      465 -
      ((lat - mapBounds.minLat) /
        Math.max(0.0001, mapBounds.maxLat - mapBounds.minLat)) *
        410,
  });
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(
      () => setReplay((value) => (value >= maxReplay ? 1 : value + 1)),
      500,
    );
    return () => window.clearInterval(id);
  }, [playing, maxReplay]);
  useEffect(() => {
    if (replay > maxReplay) setReplay(maxReplay);
  }, [maxReplay, replay]);
  useEffect(() => {
    if (rows.length && !rows.some((v) => v.id === selected))
      setSelected(rows[0]!.id);
  }, [rows, selected]);
  if (q.isLoading)
    return (
      <div className="page">
        <Skeleton rows={8} />
      </div>
    );
  if (q.isError)
    return (
      <div className="page">
        <ErrorState message={q.error.message} retry={() => q.refetch()} />
      </div>
    );
  return (
    <div className="page vessels-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">05 / AIS RECONSTRUCTION</span>
          <h1>Vessel Explorer</h1>
          <p>
            {source === "demo"
              ? "Named AIS tracks loaded from the real Ennore dataset and queried through the FastAPI proximity index."
              : "Synthetic historic traffic correlated to the inferred origin window."}
          </p>
        </div>
        <Badge tone={source === "demo" ? "blue" : "coral"}>
          {source === "demo" ? "SAMUDRA NETRA API" : "SIMULATED IDENTITIES"}
        </Badge>
      </div>
      <div className="vessel-layout">
        <Panel className="track-map">
          <PanelHead
            index="A"
            title="Origin proximity tracks"
            aside={<Badge tone="blue">AIS · 18 H</Badge>}
          />
          <svg viewBox="0 0 800 520" aria-label="Geographic AIS vessel tracks">
            <rect width="800" height="520" />
            <path className="coast" d="M0 480q170-70 320-18t480-35v93H0z" />
            <text x="690" y="495">
              ENNORE / CHENNAI
            </text>
            {rows.map((v) => (
              <g
                key={v.id}
                className={`vessel-track ${v.id === selected ? "selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`Select track for ${v.name}`}
                onClick={() => setSelected(v.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ")
                    setSelected(v.id);
                }}
              >
                {v.track.slice(0, replay).map((p, i, visibleTrack) => {
                  const n = visibleTrack[i + 1];
                  const from = project(p.lat, p.lon);
                  const to = n ? project(n.lat, n.lon) : undefined;
                  return n ? (
                    <line
                      key={p.at}
                      x1={from.x}
                      y1={from.y}
                      x2={to!.x}
                      y2={to!.y}
                      className={p.quality}
                    />
                  ) : null;
                })}
                {v.track[Math.max(0, Math.min(replay, v.track.length) - 1)] &&
                  (() => {
                    const endpoint = project(
                      v.track[
                        Math.max(0, Math.min(replay, v.track.length) - 1)
                      ]!.lat,
                      v.track[
                        Math.max(0, Math.min(replay, v.track.length) - 1)
                      ]!.lon,
                    );
                    return (
                      <>
                        <circle cx={endpoint.x} cy={endpoint.y} r="7" />
                        {v.id === selected && (
                          <text x={endpoint.x} y={endpoint.y - 13}>
                            {v.name}
                          </text>
                        )}
                      </>
                    );
                  })()}
              </g>
            ))}
          </svg>
          <div className="replay">
            <button onClick={() => setReplay(1)} aria-label="Replay from start">
              <SkipBack />
            </button>
            <button
              onClick={() => setPlaying(!playing)}
              aria-label={playing ? "Pause replay" : "Play replay"}
            >
              {playing ? <Pause /> : <Play />}
            </button>
            <input
              aria-label="Replay timestamp"
              type="range"
              min="1"
              max={maxReplay}
              value={replay}
              onChange={(e) => setReplay(+e.target.value)}
            />
            <span className="mono">
              {vessel?.track[Math.min(replay, vessel.track.length) - 1] &&
                formatUtc(
                  vessel.track[Math.min(replay, vessel.track.length) - 1]!.at,
                )}
            </span>
            <button
              onClick={() => {
                setReplay(Math.min(12, maxReplay));
                setPlaying(false);
              }}
            >
              <RotateCcw /> Reset
            </button>
          </div>
        </Panel>
        <Panel className="vessel-results">
          <PanelHead
            index="B"
            title="Vessel results"
            aside={<span>{rows.length} TRACKS</span>}
          />
          <div className="filter-stack">
            <input
              placeholder="Search vessel / ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All vessel types</option>
              <option>Tanker</option>
              <option>Cargo</option>
              <option>Offshore</option>
              <option>Fishing</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={onlyGaps}
                onChange={(e) => setOnlyGaps(e.target.checked)}
              />{" "}
              AIS gap &gt; 1h
            </label>
          </div>
          <div className="vessel-list">
            {rows.map((v) => (
              <button
                key={v.id}
                className={v.id === selected ? "selected" : ""}
                onClick={() => setSelected(v.id)}
              >
                <Ship />
                <span>
                  <b>{v.name}</b>
                  <small>
                    {v.type} · {v.flag} ·{" "}
                    {v.synthetic ? "SYNTHETIC" : "BACKEND AIS"}
                  </small>
                </span>
                <span>
                  <Badge tone={v.aisGapHours > 2 ? "coral" : "neutral"}>
                    {v.aisGapHours}h gap
                  </Badge>
                  <small>{v.relevance}</small>
                </span>
              </button>
            ))}
          </div>
          {vessel && (
            <div className="profile">
              <h3>{vessel.name}</h3>
              <p>
                {vessel.imo}
                <br />
                {vessel.mmsi}
              </p>
              <dl>
                <dt>Flag / class</dt>
                <dd>
                  {vessel.flag} · {vessel.type}
                </dd>
                <dt>Dimensions</dt>
                <dd>{vessel.dimensions}</dd>
                <dt>Destination</dt>
                <dd>{vessel.destination}</dd>
                <dt>AIS silence</dt>
                <dd>{vessel.aisGapHours} h</dd>
                <dt>Data flags</dt>
                <dd>
                  {vessel.identityIssue
                    ? "Identity inconsistency"
                    : "No identity flag"}
                </dd>
              </dl>
            </div>
          )}
        </Panel>
      </div>
      {source === "mock" ? (
        <AttributionTable incidentId="SN-260830-01" />
      ) : incidents.data?.data[0] ? (
        <AttributionTable incidentId={incidents.data.data[0].id} />
      ) : (
        <Panel>
          <PanelHead index="C" title="Vessel attribution" />
          <p className="inspector-hint">
            Attribution becomes available when PostgreSQL contains a spill
            detection. The real AIS dataset above remains available directly
            from the backend CSV.
          </p>
        </Panel>
      )}
    </div>
  );
}
