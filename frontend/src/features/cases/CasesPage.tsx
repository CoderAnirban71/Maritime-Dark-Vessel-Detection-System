import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileJson, NotebookPen, Printer, Save } from "lucide-react";
import { getDataSource, getServices } from "../../services";
import type { CaseRecord } from "../../types/domain";
import { Badge, Panel, PanelHead, Skeleton } from "../../components/ui";
import { formatUtc } from "../../lib/format";
export default function CasesPage() {
  const source = getDataSource();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["cases"],
    queryFn: () => getServices("mock").cases.list(),
  });
  const [selectedId, setSelectedId] = useState<string>();
  const [noteDraft, setNoteDraft] = useState("");
  const [noteStatus, setNoteStatus] = useState("");
  const orderedCases = [...(q.data?.data ?? [])].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
  const active =
    orderedCases.find((record) => record.id === selectedId) ?? orderedCases[0];
  const update = async (patch: Partial<CaseRecord>) => {
    if (!active) return;
    const next = { ...active, ...patch, updatedAt: new Date().toISOString() };
    await getServices("mock").cases.save(next);
    setSelectedId(next.id);
    qc.invalidateQueries({ queryKey: ["cases"] });
  };
  const addNote = async () => {
    const text = noteDraft.trim();
    if (!text || !active) return;
    await update({ notes: [...active.notes, text] });
    setNoteDraft("");
    setNoteStatus("Note saved to this case");
    window.setTimeout(() => setNoteStatus(""), 2200);
  };
  const exportJson = () => {
    if (!active) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(active, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${active.id.toLowerCase()}-report.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  if (q.isLoading)
    return (
      <div className="page">
        <Skeleton rows={8} />
      </div>
    );
  return (
    <div className="page cases-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">06 / INVESTIGATION WORKFLOW</span>
          <h1>Case operations</h1>
          <p>Evidence-led review with versioned local persistence.</p>
        </div>
        <button onClick={() => window.print()}>
          <Printer /> Print report / PDF
        </button>
      </div>
      <div className="case-layout">
        <Panel className="case-queue">
          <PanelHead index="A" title="Case queue" />
          <div className="queue-list">
            {orderedCases.map((c) => (
              <button
                className={c.id === active?.id ? "selected" : ""}
                onClick={() => {
                  setSelectedId(c.id);
                  setNoteDraft("");
                  setNoteStatus("");
                }}
                key={c.id}
              >
                <span className="rank">
                  {c.priority.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <b>{c.id}</b>
                  <strong>{c.incidentId}</strong>
                  <small>{formatUtc(c.updatedAt)}</small>
                </span>
                <span>
                  <Badge tone={c.priority === "critical" ? "coral" : "yellow"}>
                    {c.status}
                  </Badge>
                  <b>{c.evidenceCompleteness}%</b>
                </span>
              </button>
            ))}
          </div>
        </Panel>
        {active && (
          <Panel className="case-detail">
            <PanelHead
              index="B"
              title={`${active.id} · ${active.incidentId}`}
              aside={<Badge tone="coral">LOCAL CASE DATA</Badge>}
            />
            <div className="case-actions">
              <label>
                Assigned analyst{" "}
                <select
                  value={active.assignedAnalyst}
                  onChange={(e) => update({ assignedAnalyst: e.target.value })}
                >
                  <option>A. Rao</option>
                  <option>M. Iqbal</option>
                  <option>N. Sen</option>
                </select>
              </label>
              <label>
                Status{" "}
                <select
                  value={active.status}
                  onChange={(e) =>
                    update({ status: e.target.value as CaseRecord["status"] })
                  }
                >
                  <option>open</option>
                  <option>investigating</option>
                  <option>review</option>
                  <option>closed</option>
                </select>
              </label>
              <button onClick={() => update({ status: "review" })}>
                <Save /> Mark ready for review
              </button>
            </div>
            <div className="evidence-check">
              <h3>Evidence completeness</h3>
              {(
                [
                  ["Imagery reviewed", true],
                  ["Geometry verified", true],
                  ["Drift scenario saved", active.savedScenarios.length > 0],
                  ["AIS candidates compared", false],
                  ["Limitations documented", true],
                ] as [string, boolean][]
              ).map((x) => (
                <label key={x[0]}>
                  <input type="checkbox" checked={x[1] as boolean} readOnly />
                  {x[0]}
                </label>
              ))}
            </div>
            {active.savedScenarios.length > 0 && (
              <div className="saved-scenarios" aria-live="polite">
                <h3>
                  Saved drift scenarios{" "}
                  <Badge tone="yellow">{active.savedScenarios.length}</Badge>
                </h3>
                <ul>
                  {active.savedScenarios.map((scenario) => (
                    <li key={scenario}>{scenario}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="note-box">
              <NotebookPen />
              <label htmlFor="analyst-note">Analyst note</label>
              <textarea
                id="analyst-note"
                placeholder="Add an evidence note"
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter")
                    void addNote();
                }}
              />
              <button onClick={addNote} disabled={!noteDraft.trim()}>
                Add note
              </button>
              <small>Ctrl/⌘ + Enter to save</small>
              {noteStatus && (
                <output className="note-status">{noteStatus}</output>
              )}
            </div>
            <div className="note-history" aria-live="polite">
              <h3>
                Analyst note history{" "}
                <Badge tone="citron">{active.notes.length}</Badge>
              </h3>
              {active.notes.length ? (
                <ol>
                  {active.notes.map((note, index) => (
                    <li key={`${note}-${index}`}>
                      <i>{String(index + 1).padStart(2, "0")}</i>
                      <p>{note}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No analyst notes recorded yet.</p>
              )}
            </div>
          </Panel>
        )}
      </div>
      {active && (
        <Panel className="report-preview">
          <div className="watermark">ANALYST WORKSPACE</div>
          <header>
            <span className="eyebrow">SAMUDRA NETRA / INCIDENT ASSESSMENT</span>
            <h2>Marine slick correlation report</h2>
            <p>
              {active.id} · Generated {formatUtc(new Date().toISOString())}
            </p>
          </header>
          {[
            "Executive summary",
            "Detection details & geometry",
            "Imagery / model evidence",
            "Hindcast & forecast",
            "AIS reconstruction & ranked candidates",
            "Uncertainty & limitations",
            "Provenance",
            "Analyst notes",
          ].map((x, i) => (
            <section key={x}>
              <b>{String(i + 1).padStart(2, "0")}</b>
              <div>
                <h3>{x}</h3>
                <p>
                  {i === 0
                    ? `${source === "demo" ? "A backend-sourced" : "A simulated"} marine slick detection is under structured analyst review. Correlation outputs prioritize evidence collection and do not determine legal responsibility.`
                    : i === 3
                      ? active.savedScenarios.join(" · ") ||
                        "No drift scenarios saved."
                      : i === 5
                        ? `${source === "demo" ? "Environmental forcing and AIS coverage originate from the configured backend datasets" : "Environmental forcing and AIS coverage are synthetic"}. Forecast uncertainty increases materially beyond 36 hours.`
                        : i === 7
                          ? active.notes.join(" ") ||
                            "No analyst notes recorded."
                          : "Evidence section populated from the current case state."}
                </p>
              </div>
            </section>
          ))}
          <footer>
            <button onClick={() => window.print()}>
              <Printer /> Print / Save PDF
            </button>
            <button onClick={exportJson}>
              <FileJson /> Export JSON
            </button>
          </footer>
        </Panel>
      )}
    </div>
  );
}
