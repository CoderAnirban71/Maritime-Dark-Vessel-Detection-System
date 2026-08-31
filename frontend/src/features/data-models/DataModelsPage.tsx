import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Database,
  RadioTower,
} from "lucide-react";
import { getDataSource, getServices } from "../../services";
import { Badge, Panel, PanelHead, Skeleton } from "../../components/ui";
import { formatUtc } from "../../lib/format";
export default function DataModelsPage() {
  const source = getDataSource();
  const runs = useQuery({
    queryKey: ["runs"],
    queryFn: () => getServices().models.runs(),
  });
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => getServices().models.health(),
  });
  const datasets = useQuery({
    queryKey: ["datasets", source],
    queryFn: () => getServices().models.datasets(),
  });
  const formatBytes = (bytes: number) => {
    if (!bytes) return "IN MEMORY";
    const units = ["B", "KB", "MB", "GB"];
    const power = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1,
    );
    return `${(bytes / 1024 ** power).toFixed(power > 1 ? 1 : 0)} ${units[power]}`;
  };
  const connectors = [
    [
      source === "demo" ? "Sentinel-1 SAFE scene" : "Synthetic SAR fixtures",
      "healthy",
      source === "demo" ? "1.59 GB" : "14:20 UTC",
      source === "demo" ? "Real VV/VH + quick-look" : "Local typed fixture",
    ],
    [
      source === "demo" ? "Ennore AIS tracks" : "Synthetic AIS reconstruction",
      "healthy",
      source === "demo" ? "6,545 rows" : "14:18 UTC",
      source === "demo" ? "49 named vessels" : "Local typed fixture",
    ],
    [
      source === "demo" ? "CMEMS ocean forcing" : "Synthetic ocean forcing",
      "healthy",
      source === "demo" ? "NetCDF" : "12:00 UTC",
      source === "demo" ? "Real current vectors" : "Local typed fixture",
    ],
    [
      source === "demo" ? "ERA5 wind forcing" : "Synthetic wind forcing",
      "healthy",
      source === "demo" ? "NetCDF" : "12:00 UTC",
      source === "demo" ? "Real wind vectors" : "Local typed fixture",
    ],
    [
      "Samudra Netra Query API",
      source === "demo"
        ? health.data?.ok
          ? "healthy"
          : "degraded"
        : "configured",
      health.data?.latencyMs ? `${health.data.latencyMs} ms` : "—",
      "FastAPI / api/v1",
    ],
  ];
  const pipeline =
    source === "demo"
      ? [
          ["INGEST", "healthy", "5 assets"],
          ["PREPROCESS", "healthy", "SAFE parsed"],
          ["SEGMENT", "healthy", "model ready"],
          ["DRIFT", health.data?.ok ? "healthy" : "degraded", health.data?.ok ? "DB ready" : "DB offline"],
          ["AIS CORRELATE", "healthy", "49 vessels"],
        ]
      : [
          ["INGEST", "healthy", "fixtures ready"],
          ["PREPROCESS", "healthy", "deterministic"],
          ["SEGMENT", "healthy", "simulated"],
          ["DRIFT", "healthy", "simulated"],
          ["AIS CORRELATE", "healthy", "simulated"],
        ];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">07 / PIPELINE OBSERVABILITY</span>
          <h1>Data & model health</h1>
          <p>
            Configured capabilities are separated from unavailable integrations.
          </p>
        </div>
        <Badge tone={health.data?.ok ? "teal" : "coral"}>
          {health.data?.message ?? "CHECKING"}
        </Badge>
      </div>
      <div className="health-strip">
        {pipeline.map(([x, s, v]) => (
          <div key={x}>
            <span className={s} />
            <b>{x}</b>
            <small>{v}</small>
          </div>
        ))}
      </div>
      <div className="data-grid">
        <Panel>
          <PanelHead index="A" title="Ingest connectors" />
          <div className="connector-list">
            {connectors.map((c) => (
              <div key={c[0]}>
                {c[1] === "healthy" ? <CheckCircle2 /> : <CloudOff />}
                <span>
                  <b>{c[0]}</b>
                  <small>{c[3]}</small>
                </span>
                <Badge tone={c[1] === "healthy" ? "teal" : "neutral"}>
                  {c[1]}
                </Badge>
                <time>{c[2]}</time>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHead index="B" title={source === "demo" ? "Backend readiness" : "Fixture activity"} />
          <div className="queue-chart">
            {[42, 65, 28, 82, 55, 31, 74, 48, 62, 35].map((x, i) => (
              <i key={i} style={{ height: `${x}%` }} />
            ))}
          </div>
          <dl className="stat-grid">
            <dt>Data assets</dt>
            <dd>{source === "demo" ? "05 files" : "01 fixture set"}</dd>
            <dt>AIS records</dt>
            <dd>{source === "demo" ? "6,545 rows" : "08 tracks"}</dd>
            <dt>SAR scenes</dt>
            <dd>{source === "demo" ? "01 scene" : "02 fixtures"}</dd>
            <dt>Database</dt>
            <dd>{source === "demo" ? (health.data?.ok ? "online" : "offline") : "not required"}</dd>
          </dl>
        </Panel>
      </div>
      <Panel className="dataset-inventory">
        <PanelHead
          index="C"
          title="Backend asset inventory"
          aside={
            <Badge tone={source === "demo" ? "blue" : "citron"}>
              {source === "demo" ? "REAL FILES" : "MOCK FIXTURES"}
            </Badge>
          }
        />
        {datasets.isLoading ? (
          <Skeleton />
        ) : datasets.isError ? (
          <p>Asset inventory unavailable: {datasets.error.message}</p>
        ) : (
          <div className="asset-grid">
            {datasets.data?.data.map((asset) => (
              <article key={asset.id}>
                <Database />
                <span>
                  <b>{asset.name}</b>
                  <small>
                    {asset.kind.replaceAll("_", " ")} · {asset.format}
                  </small>
                </span>
                <strong>{formatBytes(asset.bytes)}</strong>
                <Badge tone={asset.status === "available" ? "teal" : "coral"}>
                  {asset.records !== undefined
                    ? `${asset.records.toLocaleString()} RECORDS`
                    : asset.status}
                </Badge>
              </article>
            ))}
          </div>
        )}
      </Panel>
      <Panel className="table-panel">
        <PanelHead
          index="D"
          title={
            source === "demo" ? "Registered model assets" : "Latest model runs"
          }
          aside={
            <Badge tone="blue">{source === "demo" ? "BACKEND" : "MOCK"}</Badge>
          }
        />
        {runs.isLoading ? (
          <Skeleton />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Model</th>
                  <th>Version</th>
                  <th>Started UTC</th>
                  <th>Latency</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {runs.data?.data.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.id}</td>
                    <td>{r.model}</td>
                    <td>{r.version}</td>
                    <td>{formatUtc(r.startedAt)}</td>
                    <td>{(r.durationMs / 1000).toFixed(1)}s</td>
                    <td>
                      {r.confidence
                        ? Math.round(r.confidence * 100) + "%"
                        : "—"}
                    </td>
                    <td>
                      <Badge tone={r.status === "success" ? "teal" : "coral"}>
                        {r.status}
                      </Badge>
                    </td>
                    <td>{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel>
        <PanelHead index="E" title="Recent notices" />
        <div className="notices">
          <span>
            <AlertTriangle /> {source === "demo"
              ? "Full-resolution inference remains an offline workflow; the API serves the real quick-look and registered model asset."
              : "Mock mode uses deterministic fixtures and does not execute the production inference pipeline."}
          </span>
          <span>
            <RadioTower /> Backend integration covers the real Sentinel-1
            quick-look, spill geometry, named AIS tracks, environmental forcing,
            model assets and evidence-ranked attribution.
          </span>
          <span>
            <Database /> {source === "demo"
              ? `Database-backed workflows are ${health.data?.ok ? "available" : "offline"}; file-backed imagery and AIS remain available.`
              : "Fixture data is stored locally for repeatable demonstrations."}
          </span>
        </div>
      </Panel>
    </div>
  );
}
