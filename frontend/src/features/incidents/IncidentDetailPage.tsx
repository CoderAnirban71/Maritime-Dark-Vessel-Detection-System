import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Satellite, Ship, Wind } from "lucide-react";
import { getServices } from "../../services";
import {
  Badge,
  ErrorState,
  Panel,
  PanelHead,
  Skeleton,
  ScoreBar,
} from "../../components/ui";
import { formatCoord, formatUtc } from "../../lib/format";
import { DriftWorkspace } from "../drift/DriftWorkspace";
import { AttributionTable } from "../attribution/AttributionTable";
export default function IncidentDetailPage() {
  const { incidentId = "" } = useParams();
  const q = useQuery({
    queryKey: ["incident", incidentId],
    queryFn: () => getServices().incidents.get(incidentId),
  });
  if (q.isLoading)
    return (
      <div className="page">
        <Skeleton rows={8} />
      </div>
    );
  if (q.isError || !q.data)
    return (
      <div className="page">
        <ErrorState message={q.error?.message || "Incident not found"} />
      </div>
    );
  const i = q.data.data;
  const events: [string, string, string][] = [
    ["INGESTION", "SAR scene received", i.firstDetected],
    ["SEGMENTATION", "Slick candidate isolated", i.firstDetected],
    ["ANALYST REVIEW", "Detection verified", i.lastObserved],
    ["DRIFT", "Origin reconstruction completed", i.lastObserved],
    ["AIS CORRELATION", "Six tracks evaluated", i.lastObserved],
  ];
  return (
    <div className="page">
      <div className="incident-head">
        <div>
          <div className="breadcrumbs">
            <Link to="/incidents">Incidents</Link> / {i.id}
          </div>
          <h1>{i.location}</h1>
          <span className="mono">{i.id}</span>{" "}
          <Badge tone={i.simulated ? "coral" : "blue"}>
            {i.simulated ? "SIMULATED" : "BACKEND RECORD"}
          </Badge>
        </div>
        <div>
          <Badge tone={i.severity === "critical" ? "coral" : "yellow"}>
            {i.severity}
          </Badge>
          <Badge tone="citron">{i.status}</Badge>
          <span>
            Owner <b>{i.assignedAnalyst}</b>
          </span>
          <Link className="button" to={`/analysis/${i.id}`}>
            Open analysis <ArrowRight />
          </Link>
        </div>
      </div>
      <nav className="anchor-nav">
        {["Summary", "Imagery", "Drift", "Vessels", "Evidence", "Activity"].map(
          (x) => (
            <a href={`#${x.toLowerCase()}`} key={x}>
              {x}
            </a>
          ),
        )}
      </nav>
      <section id="summary" className="detail-grid">
        <Panel>
          <PanelHead index="A" title="Spatial snapshot" />
          <div className="mini-map">
            <svg
              viewBox="0 0 500 240"
              role="img"
              aria-label={`Slick footprint near ${i.location}`}
            >
              <path
                className="mini-coast"
                d="M0 205Q120 160 225 205T500 180V240H0Z"
              />
              <path
                className="mini-contour"
                d="M0 70Q130 30 265 78T500 52M0 125Q150 82 280 132T500 106"
              />
              <ellipse
                className="mini-slick"
                cx="250"
                cy="112"
                rx="72"
                ry="27"
                transform={`rotate(${i.geometry.orientationDeg} 250 112)`}
              />
              <path
                className="mini-vector"
                d="M350 70l45 22m-13-15l13 15-17 1"
              />
            </svg>
            <Wind />
            <span>
              {formatCoord(i.geometry.centroid.lat, "N", "S")} ·{" "}
              {formatCoord(i.geometry.centroid.lon, "E", "W")}
            </span>
            <Link className="mini-map-link" to={`/analysis/${i.id}`}>
              Open spatial analysis
            </Link>
          </div>
        </Panel>
        <Panel>
          <PanelHead index="B" title="Spill geometry" />
          <dl className="stat-grid">
            <dt>Area</dt>
            <dd>{i.geometry.areaKm2} km²</dd>
            <dt>Perimeter</dt>
            <dd>{i.geometry.perimeterKm.toFixed(1)} km</dd>
            <dt>Axes</dt>
            <dd>
              {i.geometry.majorAxisKm.toFixed(1)} ×{" "}
              {i.geometry.minorAxisKm.toFixed(1)} km
            </dd>
            <dt>Orientation</dt>
            <dd>{i.geometry.orientationDeg}°</dd>
            <dt>Compactness</dt>
            <dd>{i.geometry.compactness}</dd>
            <dt>Estimated age</dt>
            <dd>
              {i.estimatedAgeHours[0]}–{i.estimatedAgeHours[1]} h
            </dd>
          </dl>
        </Panel>
        <Panel>
          <PanelHead index="C" title="Detection confidence" />
          <strong className="hero-metric">
            {Math.round(i.confidence * 100)}%
          </strong>
          <ScoreBar value={i.confidence * 100} />
          <p>Evidence signal only. Requires analyst confirmation.</p>
          <div className="signal-list">
            <span>
              <Satellite /> SAR texture <b>Strong</b>
            </span>
            <span>
              <Wind /> Wind alignment <b>Consistent</b>
            </span>
            <span>
              <Ship /> Vessel context <b>Reviewing</b>
            </span>
          </div>
        </Panel>
      </section>
      <section id="drift">
        <DriftWorkspace incident={i} compact />
      </section>
      <section id="vessels">
        <AttributionTable incidentId={i.id} />
      </section>
      <Panel id="activity">
        <PanelHead index="F" title="Activity timeline" />
        <ol className="timeline">
          {events.map((e, n) => (
            <li key={e[0]}>
              <i>{String(n + 1).padStart(2, "0")}</i>
              <span>
                <b>{e[0]}</b>
                {e[1]}
              </span>
              <time>{formatUtc(e[2])}</time>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
