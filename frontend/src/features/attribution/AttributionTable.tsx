import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, Pin } from "lucide-react";
import { getServices } from "../../services";
import {
  Badge,
  Panel,
  PanelHead,
  ScoreBar,
  Skeleton,
} from "../../components/ui";
export function AttributionTable({ incidentId }: { incidentId: string }) {
  const cq = useQuery({
    queryKey: ["candidates", incidentId],
    queryFn: () => getServices().attribution.rank(incidentId),
  });
  const vq = useQuery({
    queryKey: ["vessels"],
    queryFn: () => getServices().ais.list(incidentId),
  });
  const [open, setOpen] = useState<string>();
  const [pinned, setPinned] = useState<string[]>([]);
  if (cq.isLoading || vq.isLoading) return <Skeleton />;
  const vessels = vq.data?.data ?? [];
  return (
    <Panel className="candidates">
      <PanelHead
        index="E"
        title="Ranked vessel candidates"
        aside={
          <span>
            Correlation prioritizes review; it does not establish
            responsibility.
          </span>
        }
      />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Vessel / type</th>
              <th>Correlation</th>
              <th>Closest approach</th>
              <th>Time offset</th>
              <th>Trajectory</th>
              <th>Anomaly</th>
              <th>Evidence</th>
              <th>Compare</th>
            </tr>
          </thead>
          <tbody>
            {cq.data?.data.map((c, index) => {
              const v = vessels.find((x) => x.id === c.vesselId);
              return [
                <tr
                  key={c.id}
                  className={pinned.includes(c.id) ? "selected" : ""}
                >
                  <td className="rank">{String(index + 1).padStart(2, "0")}</td>
                  <td>
                    <button
                      className="cell-button"
                      onClick={() => setOpen(open === c.id ? undefined : c.id)}
                    >
                      <ChevronDown />
                      <span>
                        <b>{v?.name}</b>
                        <small>{v?.type} · SYNTHETIC</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <ScoreBar value={c.score} />
                  </td>
                  <td>{c.closestApproachKm} km</td>
                  <td>{c.timeOffsetHours} h</td>
                  <td>{c.breakdown.trajectory}%</td>
                  <td>{c.breakdown.anomaly}%</td>
                  <td>
                    <Badge tone={index < 2 ? "yellow" : "neutral"}>
                      {c.evidenceStatus}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      disabled={!pinned.includes(c.id) && pinned.length >= 3}
                      onClick={() =>
                        setPinned((x) =>
                          x.includes(c.id)
                            ? x.filter((y) => y !== c.id)
                            : [...x, c.id],
                        )
                      }
                      aria-label={`Pin ${v?.name}`}
                    >
                      <Pin />
                    </button>
                  </td>
                </tr>,
                open === c.id && (
                  <tr className="breakdown" key={`${c.id}-details`}>
                    <td colSpan={9}>
                      <div>
                        {Object.entries(c.breakdown).map(([k, v]) => (
                          <span key={k}>
                            <label>{k}</label>
                            <ScoreBar value={v} />
                          </span>
                        ))}
                      </div>
                      <p>
                        Signals: {c.flags.join(", ") || "No strong anomaly"}.
                        Data gaps and model uncertainty may materially change
                        this ranking.
                      </p>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
      {pinned.length > 0 && (
        <div className="compare-strip">
          <b>{pinned.length}/3 pinned for evidence comparison</b>
          {pinned.map((id) => (
            <Badge key={id} tone="citron">
              {vessels.find((v) => `CAN-${v.id}` === id)?.name}
            </Badge>
          ))}
        </div>
      )}
    </Panel>
  );
}
