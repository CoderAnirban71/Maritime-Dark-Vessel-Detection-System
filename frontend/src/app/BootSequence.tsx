import { useEffect, useState } from "react";
import {
  Database,
  Orbit,
  RadioTower,
  Satellite,
  SkipForward,
  Waves,
} from "lucide-react";
const stages = [
  ["INITIALIZING SENSOR GRID", "Calibrating orbital acquisition channels"],
  ["LINKING MARITIME INDEX", "Resolving H3 spatio-temporal cells"],
  ["SYNCING OCEAN STATE", "Loading current and wind vectors"],
  ["ARMING ANALYSIS CORE", "Preparing evidence workspace"],
];
export function BootSequence() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setProgress(100);
      const done = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(done);
    }
    const timer = setInterval(
      () => setProgress((value) => Math.min(100, value + 2)),
      42,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (progress < 100) return;
    const done = setTimeout(() => setVisible(false), 520);
    return () => clearTimeout(done);
  }, [progress]);
  if (!visible) return null;
  const stage = Math.min(stages.length - 1, Math.floor(progress / 25));
  return (
    <div
      className={`boot ${progress === 100 ? "complete" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="boot-grid" />
      <div className="boot-orbit">
        <div className="orbit-ring r1" />
        <div className="orbit-ring r2" />
        <div className="radar-sweep" />
        <div className="boot-core">
          <Waves />
          <i />
        </div>
        <Satellite className="satellite-node" />
        <span className="ping p1" />
        <span className="ping p2" />
        <span className="ping p3" />
      </div>
      <header>
        <div className="boot-mark">
          <Waves />
          <span>
            <b>SAMUDRA NETRA</b>
            <small>MARITIME INTELLIGENCE SYSTEM</small>
          </span>
        </div>
        <span className="mono">BOOT / 26143 · UTC</span>
      </header>
      <main>
        <div className="boot-index">
          {String(stage + 1).padStart(2, "0")}
          <i />
          04
        </div>
        <p className="eyebrow">SYSTEM STARTUP SEQUENCE</p>
        <h1>{stages[stage]![0]}</h1>
        <p>{stages[stage]![1]}</p>
        <div className="boot-progress">
          <span style={{ width: `${progress}%` }} />
          <i style={{ left: `${progress}%` }} />
        </div>
        <div className="boot-percent">
          <strong>{String(progress).padStart(3, "0")}%</strong>
          <span>
            {progress === 100
              ? "WORKSPACE READY"
              : "ESTABLISHING SECURE DATA PATH"}
          </span>
        </div>
        <ol>
          {stages.map(([name], index) => (
            <li
              className={
                index < stage ? "done" : index === stage ? "active" : ""
              }
              key={name}
            >
              <i>{index < stage ? "✓" : String(index + 1).padStart(2, "0")}</i>
              <span>{name}</span>
            </li>
          ))}
        </ol>
      </main>
      <aside>
        <span>
          <Orbit /> ORBITAL LINK <b>LOCKED</b>
        </span>
        <span>
          <RadioTower /> AIS CHANNEL <b>STANDBY</b>
        </span>
        <span>
          <Database /> DATA SOURCE <b>VERIFIED</b>
        </span>
      </aside>
      <button
        className="boot-skip"
        onClick={() => {
          setProgress(100);
          setVisible(false);
        }}
      >
        <SkipForward /> Skip sequence
      </button>
    </div>
  );
}
