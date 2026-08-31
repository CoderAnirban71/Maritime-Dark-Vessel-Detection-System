import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Eye,
  Layers3,
  Maximize2,
  MousePointer2,
  Move,
  PenLine,
  Play,
  RotateCcw,
  Ruler,
  ScanSearch,
  SplitSquareHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { getDataSource, getServices } from "../../services";
import { Badge, ErrorState, ScoreBar, Skeleton } from "../../components/ui";
import { formatUtc } from "../../lib/format";
import { DriftWorkspace } from "../drift/DriftWorkspace";
function ImageryCanvas({
  opacity,
  split,
  zoom,
  tool,
  lat,
  lon,
  backend,
  showSar,
  showMask,
  showVectors,
  previewUrl,
}: {
  opacity: number;
  split: number;
  zoom: number;
  tool: string;
  lat: number;
  lon: number;
  backend: boolean;
  showSar: boolean;
  showMask: boolean;
  showVectors: boolean;
  previewUrl?: string;
}) {
  return (
    <div
      className="imagery-canvas"
      style={
        {
          "--mask-opacity": opacity / 100,
          "--split": `${split}%`,
          "--zoom": zoom,
        } as React.CSSProperties
      }
    >
      {previewUrl && showSar && (
        <img
          className="real-scene-preview"
          src={previewUrl}
          alt="Sentinel-1 scene quick-look from the backend SAFE product"
        />
      )}
      <svg
        viewBox="0 0 900 540"
        aria-label="Synthetic SAR scene with segmentation overlay"
      >
        <defs>
          <filter id="noise">
            <feTurbulence baseFrequency=".035 .15" numOctaves="3" seed="7" />
            <feColorMatrix values=".5 0 0 0 .1 .5 0 0 0 .2 .5 0 0 0 .18 0 0 1 0" />
          </filter>
          <pattern id="scan" width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M0 1h6" />
          </pattern>
        </defs>
        <g className="scene-transform">
          {showSar && !previewUrl && (
            <rect width="900" height="540" className="sar" />
          )}
          {showSar && !previewUrl && (
            <rect width="900" height="540" filter="url(#noise)" />
          )}
          <path
            className="shore"
            d="M0 410q130-80 290-18t300-15 310-4v167H0z"
          />
          {showMask && (
            <>
              <path
                className="oil-mask"
                d="M340 182q92-64 201-7 79 41 152 26-49 54-113 65-83 14-116 75-51-35-88-16 24-65-36-143z"
              />
              <path
                className="mask-edge"
                d="M340 182q92-64 201-7 79 41 152 26-49 54-113 65-83 14-116 75-51-35-88-16 24-65-36-143z"
              />
            </>
          )}
          {showVectors && (
            <g className="vectors">
              <path d="M120 110l58 28m-14-18l14 18-22 2M690 390l50-18m-14-5l14 5-9 13" />
            </g>
          )}
        </g>
      </svg>
      <div className="eo-half">
        <div className="eo-water" />
        <div className="eo-cloud c1" />
        <div className="eo-cloud c2" />
      </div>
      <div className="split-line" />
      <span className="scene-label">
        {backend && previewUrl
          ? "REAL SENTINEL-1 SAFE QUICK-LOOK · BACKEND SPILL OVERLAY"
          : backend
            ? "BACKEND SPILL GEOMETRY · RASTER UNAVAILABLE"
            : "SYNTHETIC SAR · HH POLARIZATION"}
      </span>
      <span className="coord-readout">
        {Math.abs(lat).toFixed(3)}° {lat >= 0 ? "N" : "S"} /{" "}
        {Math.abs(lon).toFixed(3)}° {lon >= 0 ? "E" : "W"} · {zoom.toFixed(1)}×
        · {tool.toUpperCase()}
      </span>
      <span className="scale-readout">1.0 km ├────────┤</span>
    </div>
  );
}
export default function AnalysisPage() {
  const { incidentId: routeIncidentId } = useParams();
  const source = getDataSource();
  const incidentId =
    routeIncidentId ?? (source === "mock" ? "SN-260830-01" : "");
  const iq = useQuery({
    queryKey: ["incident", incidentId],
    queryFn: async () => {
      if (source === "demo" && !incidentId) {
        const list = await getServices().incidents.list();
        const first = list.data[0];
        if (!first) throw new Error("No spill detections are available");
        return { source: list.source, data: first };
      }
      return getServices().incidents.get(incidentId);
    },
  });
  const sq = useQuery({
    queryKey: ["scenes", incidentId],
    queryFn: () => getServices().imagery.list(incidentId),
  });
  const [opacity, setOpacity] = useState(62);
  const [split, setSplit] = useState(68);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState("inspect");
  const [progress, setProgress] = useState(0);
  const [runResult, setRunResult] = useState<{
    source: "mock" | "demo";
    vessels: number;
    environmental: number;
    meanCurrent: number;
    meanWind: number;
    completedAt: string;
  }>();
  const [runError, setRunError] = useState("");
  const [note, setNote] = useState(
    "Review western mask edge against wind streaks.",
  );
  const [activeSceneId, setActiveSceneId] = useState("");
  const [inspectorTab, setInspectorTab] = useState<"layers" | "inspect">(
    "layers",
  );
  const [showSar, setShowSar] = useState(true);
  const [showMask, setShowMask] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const [progressStage, setProgressStage] = useState("");
  if (iq.isLoading || sq.isLoading)
    return (
      <div className="page">
        <Skeleton rows={9} />
      </div>
    );
  if (iq.isError || sq.isError)
    return (
      <div className="page">
        <ErrorState
          message={
            iq.error?.message ??
            sq.error?.message ??
            "Analysis data unavailable"
          }
          retry={() => {
            void iq.refetch();
            void sq.refetch();
          }}
        />
      </div>
    );
  if (!iq.data) return null;
  const incident = iq.data.data;
  const scene =
    sq.data?.data.find((item) => item.id === activeSceneId) ?? sq.data?.data[0];
  const runAnalysis = async () => {
    setRunError("");
    setRunResult(undefined);
    setProgress(2);
    setProgressStage(source === "demo" ? "Submitting backend job" : "Preparing local analysis");
    try {
      const services = getServices();
      if (source === "demo" && services.imagery.startAnalysis && services.imagery.analysisStatus) {
        let job = await services.imagery.startAnalysis(incident.id);
        setProgress(job.progress);
        setProgressStage(job.stage);
        while (job.status === "running") {
          await new Promise((resolve) => window.setTimeout(resolve, 300));
          job = await services.imagery.analysisStatus(job.jobId);
          setProgress(job.progress);
          setProgressStage(job.stage);
        }
        if (job.status === "failed") throw new Error(job.error ?? "Backend analysis failed");
        setRunResult({
          source: "demo",
          vessels: job.result?.vesselTracks ?? 0,
          environmental: job.result?.environmentalSamples ?? 0,
          meanCurrent: job.result?.meanCurrentMs ?? 0,
          meanWind: (job.result?.meanWindMs ?? 0) * 1.94384,
          completedAt: job.completedAt ?? new Date().toISOString(),
        });
        setProgress(100);
        setProgressStage("Analysis complete");
        return;
      }
      const [environment, vesselResult] = await Promise.all([
        services.drift.list(incident.id),
        services.ais.list(incident.id),
      ]);
      if (source === "mock") await services.imagery.run(incident.id);
      const currents = environment.data.flatMap((item) =>
        item.vectors
          .filter((vector) => vector.kind === "current")
          .map((vector) => vector.speed),
      );
      const winds = environment.data.flatMap((item) =>
        item.vectors
          .filter((vector) => vector.kind === "wind")
          .map((vector) => vector.speed),
      );
      setRunResult({
        source: environment.source,
        vessels: vesselResult.data.length,
        environmental: environment.data.length,
        meanCurrent: currents.length
          ? currents.reduce((a, b) => a + b, 0) / currents.length
          : 0,
        meanWind: winds.length
          ? winds.reduce((a, b) => a + b, 0) / winds.length
          : 0,
        completedAt: new Date().toISOString(),
      });
      setProgress(100);
      setProgressStage("Local analysis complete");
    } catch (error) {
      setProgress(0);
      setRunError(error instanceof Error ? error.message : "Analysis failed");
    }
  };
  const tools = [
    ["pan", Move],
    ["inspect", MousePointer2],
    ["polygon", PenLine],
    ["measure", Ruler],
    ["mask", Eye],
    ["split", SplitSquareHorizontal],
    ["reset", RotateCcw],
  ] as const;
  return (
    <div className="analysis-page">
      <header className="analysis-top">
        <div>
          <select
            aria-label="Scene"
            value={scene?.id ?? ""}
            onChange={(event) => setActiveSceneId(event.target.value)}
          >
            {sq.data?.data.map((s, index) => (
              <option value={s.id} key={s.id}>
                {s.id}
                {index === 0 ? " · PRIMARY" : ""}
              </option>
            ))}
          </select>
          <Badge tone="blue">{scene?.sensor}</Badge>
          <span className="mono">{scene && formatUtc(scene.acquiredAt)}</span>
        </div>
        <div>
          <span>
            Orbit {scene?.orbit} · {scene?.pass}
          </span>
          <Badge tone="teal">PROCESSED</Badge>
          <button
            onClick={runAnalysis}
            disabled={progress > 0 && progress < 100}
          >
            <Play /> Run analysis
          </button>
        </div>
      </header>
      {progress > 0 && progress < 100 && (
        <div className="run-progress">
          <span style={{ width: `${progress}%` }} />
          <b>
            {progressStage || "Waiting for backend"} · {progress}%
          </b>
        </div>
      )}
      {progress === 100 && (
        <div className="run-progress complete">
          <span style={{ width: "100%" }} />
          <b>
            {runResult?.source === "demo"
              ? `Backend analysis complete · ${runResult.environmental} environmental samples · ${runResult.vessels} vessel tracks`
              : `Local synthetic analysis complete · New mock run recorded`}
          </b>
        </div>
      )}
      {runError && (
        <div className="run-progress failed" role="alert">
          <b>Analysis failed · {runError}</b>
        </div>
      )}
      <div className="lab">
        <aside className="tool-rail" aria-label="Imagery tools">
          {tools.map(([name, Icon]) => (
            <button
              key={name}
              className={tool === name ? "active" : ""}
              title={name}
              onClick={() =>
                name === "reset" ? (setZoom(1), setSplit(68)) : setTool(name)
              }
            >
              <Icon />
              <span>{name}</span>
            </button>
          ))}
          <button
            title="Zoom in"
            onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
          >
            <ZoomIn />
          </button>
          <button
            title="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
          >
            <ZoomOut />
          </button>
          <button title="Fit scene" onClick={() => setZoom(1)}>
            <Maximize2 />
          </button>
        </aside>
        <main className="viewport">
          <ImageryCanvas
            opacity={opacity}
            split={split}
            zoom={zoom}
            tool={tool}
            lat={incident.geometry.centroid.lat}
            lon={incident.geometry.centroid.lon}
            backend={source === "demo"}
            showSar={showSar}
            showMask={showMask}
            showVectors={showVectors}
            previewUrl={scene?.previewUrl}
          />
          <label className="split-slider">
            COMPARE{" "}
            <input
              aria-label="Comparison divider"
              type="range"
              min="5"
              max="95"
              value={split}
              onChange={(e) => setSplit(+e.target.value)}
            />
          </label>
        </main>
        <aside className="inspector">
          <div className="inspector-tabs">
            <button
              className={inspectorTab === "layers" ? "active" : ""}
              onClick={() => setInspectorTab("layers")}
            >
              <Layers3 /> Layers
            </button>
            <button
              className={inspectorTab === "inspect" ? "active" : ""}
              onClick={() => setInspectorTab("inspect")}
            >
              <ScanSearch /> Inspect
            </button>
          </div>
          {inspectorTab === "inspect" && (
            <section>
              <h3>Correlated backend data</h3>
              {runResult ? (
                <dl className="stat-grid">
                  <dt>Data source</dt>
                  <dd>
                    {runResult.source === "demo" ? "SAMUDRA API" : "MOCK"}
                  </dd>
                  <dt>AIS tracks</dt>
                  <dd>{runResult.vessels}</dd>
                  <dt>Environmental samples</dt>
                  <dd>{runResult.environmental}</dd>
                  <dt>Mean current</dt>
                  <dd>{runResult.meanCurrent.toFixed(2)} m/s</dd>
                  <dt>Mean wind</dt>
                  <dd>{runResult.meanWind.toFixed(1)} kn</dd>
                  <dt>Completed</dt>
                  <dd>{formatUtc(runResult.completedAt)}</dd>
                </dl>
              ) : (
                <p className="inspector-hint">
                  Run analysis to correlate this spill with time-matched AIS,
                  ocean-current, and wind records.
                </p>
              )}
            </section>
          )}
          {inspectorTab === "layers" && (
            <section>
              <h3>Visualization</h3>
              <label>
                <input
                  type="checkbox"
                  checked={showSar}
                  onChange={(event) => setShowSar(event.target.checked)}
                />{" "}
                SAR backscatter
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showMask}
                  onChange={(event) => setShowMask(event.target.checked)}
                />{" "}
                Segmentation mask
              </label>
              <label>
                Mask opacity <output>{opacity}%</output>
                <input
                  type="range"
                  value={opacity}
                  onChange={(e) => setOpacity(+e.target.value)}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showVectors}
                  onChange={(event) => setShowVectors(event.target.checked)}
                />{" "}
                Drift vectors
              </label>
            </section>
          )}
          <section>
            <h3>Spill properties</h3>
            <dl className="stat-grid">
              <dt>Area</dt>
              <dd>{incident.geometry.areaKm2} km²</dd>
              <dt>Perimeter</dt>
              <dd>{incident.geometry.perimeterKm.toFixed(1)} km</dd>
              <dt>Axes</dt>
              <dd>
                {incident.geometry.majorAxisKm.toFixed(1)} /{" "}
                {incident.geometry.minorAxisKm.toFixed(1)} km
              </dd>
              <dt>Orientation</dt>
              <dd>{incident.geometry.orientationDeg}°</dd>
              <dt>Shoreline</dt>
              <dd>{incident.coastalProximityKm} km</dd>
              <dt>Age</dt>
              <dd>{incident.estimatedAgeHours.join("–")} h</dd>
            </dl>
          </section>
          <section>
            <h3>Evidence signals</h3>
            {[
              ["Dark-pixel response", 94],
              ["Texture consistency", 87],
              ["Wind alignment", 78],
              ["Look-alike rejection", 71],
            ].map((x) => (
              <div className="evidence-signal" key={x[0]}>
                <span>{x[0]}</span>
                <ScoreBar value={x[1] as number} />
              </div>
            ))}
            <small>Signals support review; they are not proof of oil.</small>
          </section>
          <section>
            <h3>Annotation</h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Analyst note"
            />
            <div>
              <Badge tone="citron">MASK EDGE</Badge> <Badge>REVIEW</Badge>
            </div>
          </section>
        </aside>
      </div>
      <div className="filmstrip">
        <strong>SCENE TIMELINE</strong>
        {sq.data?.data.map((s) => (
          <button
            key={s.id}
            className={s.id === scene?.id ? "active" : ""}
            onClick={() => setActiveSceneId(s.id)}
          >
            <i className={`thumb ${s.sensor.toLowerCase()}`} />
            <span>
              {s.id}
              <small>{formatUtc(s.acquiredAt)}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="analysis-drift">
        <DriftWorkspace incident={incident} analystNote={note} />
      </div>
    </div>
  );
}
