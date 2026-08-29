import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, Flag } from 'lucide-react';

interface TimelineScrubberProps {
  currentTimestamp: string;
  onTimeChange: (isoTime: string) => void;
}

// Key Milestones in the Ennore 2017 Spill Incident
const MILESTONES = [
  { label: 'T-0 Inception', time: '2017-01-27T12:00:00Z', desc: 'AIS monitoring active' },
  { label: 'T-Collision', time: '2017-01-28T04:03:00Z', desc: 'Dawn K. collides with BW Maple (-11.2 kts speed drop)' },
  { label: 'T-Hindcast Origin', time: '2017-01-28T04:05:00Z', desc: 'CMEMS drift backward convergence node' },
  { label: 'T-SAR Observation', time: '2017-01-29T00:31:32Z', desc: 'Sentinel-1A SAR C-band pass detects 19.45 km² slick' },
];

const START_MS = new Date('2017-01-27T12:00:00Z').getTime();
const END_MS = new Date('2017-01-29T01:00:00Z').getTime();
const TOTAL_DURATION_MS = END_MS - START_MS;

export function TimelineScrubber({ currentTimestamp, onTimeChange }: TimelineScrubberProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  const currentMs = new Date(currentTimestamp).getTime();
  const progressPercent = Math.min(100, Math.max(0, ((currentMs - START_MS) / TOTAL_DURATION_MS) * 100));

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const stepMs = 15 * 60 * 1000 * playbackSpeed; // 15 mins per tick * speed
      const nextMs = currentMs + stepMs;

      if (nextMs >= END_MS) {
        onTimeChange(new Date(END_MS).toISOString());
        setIsPlaying(false);
      } else {
        onTimeChange(new Date(nextMs).toISOString());
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isPlaying, currentMs, playbackSpeed, onTimeChange]);

  const handleTogglePlay = () => {
    if (!isPlaying && currentMs >= END_MS) {
      onTimeChange(new Date(START_MS).toISOString());
    }
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseFloat(e.target.value);
    const targetMs = START_MS + (TOTAL_DURATION_MS * percent) / 100;
    onTimeChange(new Date(targetMs).toISOString());
  };

  return (
    <div className="bg-[#0B0F0E] border border-[#29332F] rounded-xs p-2.5 space-y-2 select-none font-mono text-xs">
      {/* 1. Top Controls & Live Scrubber Time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Play / Pause Toggle */}
          <button
            type="button"
            onClick={handleTogglePlay}
            className="w-7 h-7 rounded-xs bg-[#161D1B] hover:bg-[#1C2522] border border-[#29332F] text-[#5EE6C0] flex items-center justify-center cursor-pointer transition-colors"
            title={isPlaying ? 'Pause Kinematic Playback' : 'Play Kinematic Playback'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={() => onTimeChange('2017-01-27T12:00:00Z')}
            className="w-7 h-7 rounded-xs bg-[#161D1B] hover:bg-[#1C2522] border border-[#29332F] text-[#A5B1AC] flex items-center justify-center cursor-pointer transition-colors"
            title="Reset to Start"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          {/* Playback Speed Multiplier */}
          <button
            type="button"
            onClick={() => setPlaybackSpeed((s) => (s === 1 ? 4 : s === 4 ? 16 : 1))}
            className="px-2 py-1 bg-[#161D1B] border border-[#29332F] text-[#5EE6C0] text-[10px] rounded-xs cursor-pointer font-bold"
            title="Adjust Simulation Rate"
          >
            {playbackSpeed}x SPEED
          </button>

          <span className="text-[10px] text-[#68746F] hidden sm:inline uppercase">
            TEMPORAL RECONSTRUCTION WINDOW
          </span>
        </div>

        {/* Current Scrub Time Display */}
        <div className="flex items-center gap-1.5 bg-[#111716] px-2.5 py-1 rounded-xs border border-[#202925] text-[11px] text-[#E8EFEC] font-bold">
          <Clock className="w-3.5 h-3.5 text-[#5EE6C0]" />
          <span>{new Date(currentTimestamp).toISOString().replace('T', ' ').replace('Z', '')} UTC</span>
        </div>
      </div>

      {/* 2. Range Slider */}
      <div className="relative pt-1">
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progressPercent}
          onChange={handleSliderChange}
          className="w-full h-1.5 bg-[#161D1B] rounded-xs cursor-pointer accent-[#5EE6C0]"
        />

        {/* Milestone Tick Markers */}
        <div className="flex justify-between items-center pt-1.5 text-[9px] text-[#68746F]">
          {MILESTONES.map((m) => {
            const mMs = new Date(m.time).getTime();
            const isPassed = currentMs >= mMs;
            const isNear = Math.abs(currentMs - mMs) < 60 * 60 * 1000;

            return (
              <button
                key={m.label}
                type="button"
                onClick={() => onTimeChange(m.time)}
                className={`flex items-center gap-1 transition-colors cursor-pointer text-left ${
                  isNear
                    ? 'text-[#5EE6C0] font-bold underline'
                    : isPassed
                    ? 'text-[#A5B1AC]'
                    : 'text-[#46514D] hover:text-[#68746F]'
                }`}
                title={m.desc}
              >
                <Flag className="w-2.5 h-2.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
