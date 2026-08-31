import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { getServices } from "../../services";
import {
  Badge,
  EmptyState,
  ErrorState,
  Panel,
  Skeleton,
} from "../../components/ui";
import { formatUtc } from "../../lib/format";
export default function IncidentsPage() {
  const q = useQuery({
    queryKey: ["incidents"],
    queryFn: () => getServices().incidents.list(),
  });
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [sort, setSort] = useState<"time" | "confidence" | "area">("time");
  const data = useMemo(() => {
    const rows = (q.data?.data ?? []).filter(
      (i) =>
        (severity === "all" || i.severity === severity) &&
        `${i.id} ${i.location} ${i.assignedAnalyst}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    return rows.sort((a, b) =>
      sort === "confidence"
        ? b.confidence - a.confidence
        : sort === "area"
          ? b.geometry.areaKm2 - a.geometry.areaKm2
          : Date.parse(b.firstDetected) - Date.parse(a.firstDetected),
    );
  }, [q.data, query, severity, sort]);
  const exportCsv = () => {
    const csv = [
      "ID,Location,Detected,Sensor,Area,Confidence,Severity,Status",
      ...data.map((i) =>
        [
          i.id,
          `"${i.location}"`,
          i.firstDetected,
          i.sensor,
          i.geometry.areaKm2,
          i.confidence,
          i.severity,
          i.status,
        ].join(","),
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "signal-coast-incidents.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">02 / DETECTION REGISTER</span>
          <h1>Incident operations</h1>
          <p>
            Dense review queue for satellite-confirmed and pending detections.
          </p>
        </div>
        <button onClick={exportCsv}>
          <Download /> Export filtered CSV
        </button>
      </div>
      <Panel className="table-panel">
        <div className="filterbar wide">
          <label>
            <Search />
            <span className="sr-only">Search incidents</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ID, location, analyst"
            />
          </label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="all">All severity</option>
            <option>critical</option>
            <option>high</option>
            <option>medium</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="time">Newest first</option>
            <option value="confidence">Confidence</option>
            <option value="area">Slick area</option>
          </select>
          <span>{data.length} results</span>
        </div>
        {q.isLoading ? (
          <Skeleton rows={7} />
        ) : q.isError ? (
          <ErrorState message={q.error.message} />
        ) : data.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Incident</th>
                  <th>Location</th>
                  <th>First detected UTC</th>
                  <th>Latest observation</th>
                  <th>Sensor</th>
                  <th>Area</th>
                  <th>Confidence</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Analyst</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link to={`/incidents/${i.id}`} className="mono strong">
                        {i.id}
                      </Link>
                      <small>
                        {i.simulated ? "SIMULATED" : "BACKEND RECORD"}
                      </small>
                    </td>
                    <td>{i.location}</td>
                    <td className="mono">{formatUtc(i.firstDetected)}</td>
                    <td className="mono">{formatUtc(i.lastObserved)}</td>
                    <td>
                      <Badge tone="blue">{i.sensor}</Badge>
                    </td>
                    <td>{i.geometry.areaKm2} km²</td>
                    <td>
                      <strong>{Math.round(i.confidence * 100)}%</strong>
                    </td>
                    <td>
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
                    </td>
                    <td>{i.status}</td>
                    <td>{i.assignedAnalyst}</td>
                    <td>
                      <Link
                        to={`/analysis/${i.id}`}
                        aria-label={`Analyse ${i.id}`}
                      >
                        <ExternalLink />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
